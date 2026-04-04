"""
USD Monitor Phase 2 — Walk-Forward Backtest
Day-by-day simulation from TRAIN_END, long/short DXY positions.
ATR sizing × regime multiplier × Kelly × circuit breaker.
Output: nav_curve.json → NavCurveData interface.
"""
import json
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from scipy.stats import spearmanr

from config_v2 import (
    FACTOR_COLS, MODEL_PATH, OUTPUT_DIR, TRAIN_END,
    FORWARD_DAYS, SIGNAL_THRESHOLDS, ATR_STOP_MULT,
    ACCOUNT_EQUITY, MIN_HOLD_DAYS, TRADE_COST_BPS,
)
from kelly import compute_kelly_risk, position_size
from circuit_breaker import CircuitBreaker, ic_signal_scale


class NaNSafeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.floating, float)):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return round(float(obj), 6)
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def _save_json(data, filename):
    path = OUTPUT_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, cls=NaNSafeEncoder, ensure_ascii=False, indent=2)
    print(f"  → {path}")


def _signal_grade(pred: float) -> str:
    if pred >= SIGNAL_THRESHOLDS["strong_buy"]:
        return "Strong Buy"
    elif pred >= SIGNAL_THRESHOLDS["buy"]:
        return "Buy"
    elif pred <= SIGNAL_THRESHOLDS["strong_sell"]:
        return "Strong Sell"
    elif pred <= SIGNAL_THRESHOLDS["sell"]:
        return "Sell"
    return "Neutral"


def run_backtest(features_df: pd.DataFrame) -> dict:
    """
    Walk-forward backtest from TRAIN_END.

    Strategy:
    - Model predicts 20d DXY return
    - Signal grade determines direction (long/short) and size
    - ATR-based stop loss
    - Regime multiplier adjusts position
    - Kelly criterion sizes risk
    - Circuit breaker protects capital

    Output: nav_curve.json matching NavCurveData interface.
    """
    print("=" * 60)
    print("[backtest] USD Monitor Walk-Forward Backtest")
    print("=" * 60)

    # Load model
    if not MODEL_PATH.exists():
        print("[backtest] No model found, training first...")
        from train import train_model
        model = train_model(features_df)
    else:
        model = XGBRegressor()
        model.load_model(str(MODEL_PATH))

    # Get test period
    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    test_df = features_df[test_mask].copy()

    if len(test_df) < 30:
        print(f"[backtest] Insufficient test data ({len(test_df)} rows)")
        return {"error": "insufficient_data"}

    print(f"[backtest] Test period: {test_df.index[0]} to {test_df.index[-1]} ({len(test_df)} days)")

    # Regime detection
    from regime_usd import detect_regime_v2

    # State
    nav = 1.0
    peak_nav = 1.0
    equity = ACCOUNT_EQUITY
    position = 0.0      # +1 = long, -1 = short, 0 = flat
    entry_price = 0.0
    entry_date = None
    stop_price = 0.0
    trade_history = []
    predictions = []
    actuals = []
    cb = CircuitBreaker()

    history = []
    dxy_start = test_df.iloc[0]["dxy_price"]

    for i in range(len(test_df)):
        row = test_df.iloc[i]
        date = test_df.index[i]
        price = row["dxy_price"]
        atr = row.get("atr", 0.5)

        if np.isnan(price) or price <= 0:
            continue

        # DXY normalized (buy-and-hold benchmark)
        dxy_norm = price / dxy_start if dxy_start > 0 else 1.0

        # Circuit breaker check
        cb_state = cb.update(nav, date)
        cb_mult = cb_state["position_mult"]

        # Model prediction
        X = row[FACTOR_COLS].values.reshape(1, -1)
        X = np.nan_to_num(X, nan=0.0, posinf=5.0, neginf=-5.0)
        pred = float(model.predict(X)[0])
        grade = _signal_grade(pred)

        predictions.append(pred)
        actual = row.get("target", np.nan)
        if not np.isnan(actual):
            actuals.append(actual)

        # IC-based signal scaling
        rolling_ic = 0.10  # Default
        if len(predictions) >= 60 and len(actuals) >= 60:
            n = min(60, len(predictions), len(actuals))
            ic, _ = spearmanr(predictions[-n:], actuals[-n:])
            rolling_ic = float(ic) if not np.isnan(ic) else 0.0
        ic_scale = ic_signal_scale(rolling_ic)

        # Regime multiplier
        try:
            row_idx_full = features_df.index.get_loc(date)
            regime = detect_regime_v2(features_df, row_idx=row_idx_full)
            regime_mult = regime["multiplier"]
        except Exception:
            regime_mult = 1.0

        # Kelly sizing
        kelly = compute_kelly_risk(trade_history, signal_grade=grade)
        risk_pct = kelly["risk_pct"]

        # Combine multipliers
        effective_risk = risk_pct * regime_mult * ic_scale * cb_mult

        # Check existing position
        if position != 0 and entry_date is not None:
            days_held = (date - entry_date).days

            # Stop loss check
            if position > 0 and price <= stop_price:
                # Long stopped out
                pnl_pct = (price - entry_price) / entry_price * 100
                pnl_pct -= TRADE_COST_BPS / 100  # Exit cost
                nav *= (1 + pnl_pct / 100)
                trade_history.append({"pnl_pct": pnl_pct, "days": days_held})
                position = 0.0

            elif position < 0 and price >= stop_price:
                # Short stopped out
                pnl_pct = (entry_price - price) / entry_price * 100
                pnl_pct -= TRADE_COST_BPS / 100
                nav *= (1 + pnl_pct / 100)
                trade_history.append({"pnl_pct": pnl_pct, "days": days_held})
                position = 0.0

            # Time-based exit (hold for FORWARD_DAYS)
            elif days_held >= FORWARD_DAYS:
                if position > 0:
                    pnl_pct = (price - entry_price) / entry_price * 100
                else:
                    pnl_pct = (entry_price - price) / entry_price * 100
                pnl_pct -= TRADE_COST_BPS / 100
                nav *= (1 + pnl_pct / 100)
                trade_history.append({"pnl_pct": pnl_pct, "days": days_held})
                position = 0.0

        # New position entry
        if position == 0 and effective_risk > 0 and grade != "Neutral":
            # Entry cost
            nav *= (1 - TRADE_COST_BPS / 10000)

            if "Buy" in grade:
                position = 1.0
                entry_price = price
                entry_date = date
                stop_price = price - atr * ATR_STOP_MULT
            elif "Sell" in grade:
                position = -1.0
                entry_price = price
                entry_date = date
                stop_price = price + atr * ATR_STOP_MULT

        # Drawdown
        if nav > peak_nav:
            peak_nav = nav
        drawdown = (peak_nav - nav) / peak_nav if peak_nav > 0 else 0.0

        history.append({
            "date": date.strftime("%Y-%m-%d"),
            "nav": round(float(nav), 6),
            "dxy_norm": round(float(dxy_norm), 6),
            "drawdown": round(float(drawdown), 6),
        })

    # Close any open position at end
    if position != 0:
        final_price = test_df.iloc[-1]["dxy_price"]
        if position > 0:
            pnl_pct = (final_price - entry_price) / entry_price * 100
        else:
            pnl_pct = (entry_price - final_price) / entry_price * 100
        pnl_pct -= TRADE_COST_BPS / 100
        nav *= (1 + pnl_pct / 100)
        trade_history.append({"pnl_pct": pnl_pct, "days": 0})

    # Summary statistics
    total_return = (nav - 1.0) * 100
    n_trades = len(trade_history)
    wins = [t for t in trade_history if t["pnl_pct"] > 0]
    win_rate = len(wins) / n_trades if n_trades > 0 else 0.0

    # Sharpe ratio (daily NAV returns)
    if len(history) > 1:
        navs = np.array([h["nav"] for h in history])
        daily_rets = np.diff(navs) / navs[:-1]
        sharpe = (daily_rets.mean() / daily_rets.std() * np.sqrt(252)
                  if daily_rets.std() > 0 else 0.0)
    else:
        sharpe = 0.0

    # Max drawdown
    max_dd = max(h["drawdown"] for h in history) if history else 0.0

    result = {
        "total_return": round(float(total_return), 2),
        "sharpe": round(float(sharpe), 4),
        "max_drawdown": round(float(max_dd), 4),
        "win_rate": round(float(win_rate), 4),
        "history": history,
    }

    _save_json(result, "nav_curve.json")

    print(f"\n[backtest] Results:")
    print(f"  Total Return: {total_return:+.2f}%")
    print(f"  Sharpe Ratio: {sharpe:.4f}")
    print(f"  Max Drawdown: {max_dd:.2%}")
    print(f"  Win Rate:     {win_rate:.1%} ({len(wins)}/{n_trades} trades)")
    print(f"  NAV History:  {len(history)} days")

    return result


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    result = run_backtest(features)
