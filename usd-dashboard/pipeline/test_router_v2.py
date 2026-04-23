"""
Router v2 Comparison Test
Simulates old (balanced) vs new (IC-adaptive) routing on historical data.
"""
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from scipy.stats import spearmanr

from config_v2 import (
    ALL_FACTOR_COLS_PRUNED as FACTOR_COLS, MODEL_PATH, TRAIN_END,
    FORWARD_DAYS, SIGNAL_THRESHOLDS, ATR_STOP_MULT, TRADE_COST_BPS,
)
from signal_router import (
    route_normal, _ml_direction, _gamma_direction,
    CREDIBILITY_MATRIX, CREDIBILITY_MATRIX_ML_DOM, CREDIBILITY_MATRIX_GAMMA_DOM,
    ML_DOMINANT_IC,
)


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


def simulate_engine(features_df, gamma_scores, mode="v2_adaptive"):
    """
    Simulate trading with different routing modes.

    modes:
      - "ml_only": Pure ML signal, no γ influence
      - "v1_balanced": Old 3×3 matrix (always balanced)
      - "v2_adaptive": New IC-adaptive routing
      - "gamma_only": Pure γ signal (no ML)
    """
    model = XGBRegressor()
    model.load_model(str(MODEL_PATH))

    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    test_df = features_df[test_mask].copy()

    nav = 1.0
    position = 0.0
    entry_price = 0.0
    entry_idx = 0
    current_size_mult = 1.0
    predictions = []
    actuals = []
    trade_history = []

    for i in range(len(test_df)):
        row = test_df.iloc[i]
        price = row["dxy_price"]
        atr = row.get("atr", 0.5)

        if np.isnan(price) or price <= 0:
            continue

        # ML prediction
        X = row[FACTOR_COLS].values.reshape(1, -1)
        X = np.nan_to_num(X, nan=0.0, posinf=5.0, neginf=-5.0)
        pred = float(model.predict(X)[0])
        grade = _signal_grade(pred)

        predictions.append(pred)
        actual = row.get("target", np.nan)
        if not np.isnan(actual):
            actuals.append(actual)

        # Rolling IC (60-day)
        rolling_ic = 0.10
        if len(predictions) >= 60 and len(actuals) >= 60:
            n = min(60, len(predictions), len(actuals))
            ic, _ = spearmanr(predictions[-n:], actuals[-n:])
            rolling_ic = float(ic) if not np.isnan(ic) else 0.0

        # Gamma score (simulate: ~50 ± small variation, matching real data)
        gamma = gamma_scores[i] if i < len(gamma_scores) else 50.0

        # Close existing position after FORWARD_DAYS
        if position != 0 and (i - entry_idx) >= FORWARD_DAYS:
            if position > 0:
                pnl_pct = (price - entry_price) / entry_price * 100
            else:
                pnl_pct = (entry_price - price) / entry_price * 100
            pnl_pct *= current_size_mult  # Apply position sizing
            pnl_pct -= TRADE_COST_BPS / 100
            nav *= (1 + pnl_pct / 100)
            trade_history.append(pnl_pct)
            position = 0.0

        # Stop loss
        if position != 0:
            if position > 0 and price <= entry_price - atr * ATR_STOP_MULT:
                pnl_pct = ((price - entry_price) / entry_price * 100) * current_size_mult - TRADE_COST_BPS / 100
                nav *= (1 + pnl_pct / 100)
                trade_history.append(pnl_pct)
                position = 0.0
            elif position < 0 and price >= entry_price + atr * ATR_STOP_MULT:
                pnl_pct = ((entry_price - price) / entry_price * 100) * current_size_mult - TRADE_COST_BPS / 100
                nav *= (1 + pnl_pct / 100)
                trade_history.append(pnl_pct)
                position = 0.0

        # New entry
        if position == 0:
            size_mult = 1.0  # Default full size

            if mode == "ml_only":
                # Pure ML — full size
                if grade != "Neutral":
                    direction = 1.0 if "Buy" in grade else -1.0
                    position = direction
                    size_mult = 1.0
                    entry_price = price
                    entry_idx = i
                    nav *= (1 - TRADE_COST_BPS / 10000)

            elif mode == "v1_balanced":
                # Old router: always use balanced matrix
                decision = route_normal(gamma, pred, rolling_ic=0.05)  # Force balanced
                if decision["action"] != "FLAT" and decision["size_mult"] > 0:
                    direction = 1.0 if decision["action"] == "LONG" else -1.0
                    position = direction
                    size_mult = decision["size_mult"]
                    entry_price = price
                    entry_idx = i
                    nav *= (1 - TRADE_COST_BPS / 10000)

            elif mode == "v2_adaptive":
                # New IC-adaptive router
                decision = route_normal(gamma, pred, rolling_ic=rolling_ic)
                if decision["action"] != "FLAT" and decision["size_mult"] > 0:
                    direction = 1.0 if decision["action"] == "LONG" else -1.0
                    position = direction
                    size_mult = decision["size_mult"]
                    entry_price = price
                    entry_idx = i
                    nav *= (1 - TRADE_COST_BPS / 10000)

            elif mode == "gamma_only":
                # Pure gamma
                if gamma >= 65:
                    position = 1.0
                    entry_price = price
                    entry_idx = i
                    nav *= (1 - TRADE_COST_BPS / 10000)
                elif gamma < 35:
                    position = -1.0
                    entry_price = price
                    entry_idx = i
                    nav *= (1 - TRADE_COST_BPS / 10000)

            # Store size_mult for PnL calculation
            if position != 0:
                current_size_mult = size_mult

    # Close final position
    if position != 0:
        final_price = test_df.iloc[-1]["dxy_price"]
        if position > 0:
            pnl_pct = (final_price - entry_price) / entry_price * 100
        else:
            pnl_pct = (entry_price - final_price) / entry_price * 100
        pnl_pct *= current_size_mult
        pnl_pct -= TRADE_COST_BPS / 100
        nav *= (1 + pnl_pct / 100)
        trade_history.append(pnl_pct)

    # Stats
    total_ret = (nav - 1) * 100
    n_trades = len(trade_history)
    wins = sum(1 for p in trade_history if p > 0)
    win_rate = wins / n_trades if n_trades > 0 else 0
    avg_pnl = np.mean(trade_history) if trade_history else 0

    return {
        "mode": mode,
        "total_return": round(total_ret, 2),
        "n_trades": n_trades,
        "win_rate": round(win_rate * 100, 1),
        "avg_pnl": round(avg_pnl, 3),
        "final_nav": round(nav, 6),
    }


def main():
    from fetch_features import fetch_all_history
    from features import build_features

    print("=" * 60)
    print("Router v2 Comparison Test")
    print("=" * 60)

    # Load data
    raw = fetch_all_history()
    features = build_features(raw)

    test_mask = features.index > pd.Timestamp(TRAIN_END)
    n_test = test_mask.sum()

    # Simulate γ scores: stuck near 50 (matching real-world observation)
    np.random.seed(42)
    gamma_scores = 50 + np.random.randn(n_test) * 5  # Mean=50, std=5
    gamma_scores = np.clip(gamma_scores, 30, 70)

    print(f"\nTest period: {n_test} days")
    print(f"Simulated γ: mean={gamma_scores.mean():.1f}, std={gamma_scores.std():.1f}")
    print(f"γ neutral (35-65): {((gamma_scores >= 35) & (gamma_scores < 65)).sum()}/{n_test} = "
          f"{((gamma_scores >= 35) & (gamma_scores < 65)).mean()*100:.0f}%")
    print()

    modes = ["ml_only", "v1_balanced", "v2_adaptive", "gamma_only"]
    results = []

    for mode in modes:
        print(f"Running {mode}...")
        r = simulate_engine(features, gamma_scores, mode=mode)
        results.append(r)
        print(f"  → ret={r['total_return']:+.2f}%, trades={r['n_trades']}, win={r['win_rate']}%")

    print("\n" + "=" * 60)
    print("COMPARISON RESULTS")
    print("=" * 60)
    print(f"{'Mode':<20} {'Return':>10} {'Trades':>8} {'WinRate':>8}")
    print("-" * 50)
    for r in results:
        print(f"{r['mode']:<20} {r['total_return']:>+9.2f}% {r['n_trades']:>7} {r['win_rate']:>7.1f}%")

    print("\n结论:")
    v1 = next(r for r in results if r['mode'] == 'v1_balanced')
    v2 = next(r for r in results if r['mode'] == 'v2_adaptive')
    ml = next(r for r in results if r['mode'] == 'ml_only')

    print(f"  ML单引擎:   {ml['total_return']:+.2f}%")
    print(f"  v1路由(旧):  {v1['total_return']:+.2f}% (Δ vs ML: {v1['total_return']-ml['total_return']:+.2f}%)")
    print(f"  v2路由(新):  {v2['total_return']:+.2f}% (Δ vs ML: {v2['total_return']-ml['total_return']:+.2f}%)")

    improvement = v2['total_return'] - v1['total_return']
    print(f"\n  v2 vs v1 改善: {improvement:+.2f}%")
    if improvement > 0:
        print("  ✅ v2 IC-adaptive routing 改善了路由器性能")
    else:
        print("  ⚠ v2 未改善，需要进一步调整")


if __name__ == "__main__":
    main()
