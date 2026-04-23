"""
USD Monitor P2 — Conflict Score Backtest & Optimal Threshold Search

Backtests the conflict score's predictive value as a regime transition indicator,
and finds the optimal conflict threshold for switching to conflict option mode.

Key questions this module answers:
  1. Does high conflict_score → worse subsequent returns? (Soros hypothesis)
  2. What is the optimal threshold for triggering conflict option?
  3. How does the 3×3 matrix perform by cell? (attribution by consensus type)
  4. Conflict score time-series — is it a leading indicator of volatility?

References:
  - Roundtable P2: conflict score time-series backtest + optimal threshold search
  - Soros: conflict_score > 0.6 = regime transition leading indicator
"""
import json
import numpy as np
import pandas as pd
from datetime import datetime
from xgboost import XGBRegressor

from config_v2 import (
    ALL_FACTOR_COLS_PRUNED as FACTOR_COLS, MODEL_PATH, OUTPUT_DIR, TRAIN_END,
    FORWARD_DAYS, SIGNAL_THRESHOLDS, ATR_STOP_MULT,
    ACCOUNT_EQUITY, TRADE_COST_BPS,
)


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
        if isinstance(obj, (pd.Timestamp, datetime)):
            return obj.isoformat()[:10]
        return super().default(obj)


def _save_json(data, filename):
    path = OUTPUT_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, cls=NaNSafeEncoder, ensure_ascii=False, indent=2)
    print(f"  → {path}")


# ══════════════════════════════════════════════════════════════════════════
# Simulate γ from ML factors (proxy for backtest)
# ══════════════════════════════════════════════════════════════════════════

def _proxy_gamma(row) -> float:
    """
    Approximate γ score from ML factors when actual Phase 1 γ unavailable.
    Uses rf-related factors as proxy.

    v2: γ_proxy = 50 + 10*(F1_RateDiff) + 5*(F2_RealRateDelta) - 5*(F4_VIX) + 3*(F6_YCMomentum)
    Clipped to [0, 100].
    """
    def _safe(val):
        try:
            return 0 if (val is None or np.isnan(val)) else val
        except (TypeError, ValueError):
            return 0

    f1 = _safe(row.get("F1_RateDiff", 0))
    f2 = _safe(row.get("F2_RealRateDelta", row.get("F2_RealRate", 0)))
    f4 = _safe(row.get("F4_VIX", 0))
    f6 = _safe(row.get("F6_YCMomentum", row.get("F6_RatePath", 0)))

    gamma = 50.0 + 10 * f1 + 5 * f2 - 5 * f4 + 3 * f6
    return float(np.clip(gamma, 0, 100))


def _gamma_direction(gamma_score):
    if gamma_score >= 65:
        return "bull"
    elif gamma_score < 35:
        return "bear"
    return "neutral"


def _ml_direction(ml_pred):
    if ml_pred >= SIGNAL_THRESHOLDS["buy"]:
        return "buy"
    elif ml_pred <= SIGNAL_THRESHOLDS["sell"]:
        return "sell"
    return "neutral"


def _compute_conflict(gamma_score, ml_pred):
    g_norm = (gamma_score - 50) / 50
    m_norm = max(-1.0, min(1.0, ml_pred / 2.0))
    return abs(g_norm - m_norm) / 2.0


# ══════════════════════════════════════════════════════════════════════════
# Conflict Score Time-Series Backtest
# ══════════════════════════════════════════════════════════════════════════

def run_conflict_backtest(features_df):
    """
    Walk-forward conflict score analysis.

    For each day in test period:
      1. Compute ML prediction and proxy γ
      2. Compute conflict score
      3. Track actual 20d forward return
      4. Categorize into conflict buckets

    Output: conflict_backtest.json
    """
    print("=" * 60)
    print("[P2] Conflict Score Backtest")
    print("=" * 60)

    # Load model
    if not MODEL_PATH.exists():
        print("  No model found, skipping conflict backtest")
        return {"error": "no_model"}

    model = XGBRegressor()
    model.load_model(str(MODEL_PATH))

    # Test period
    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    test_df = features_df[test_mask].copy()

    if len(test_df) < FORWARD_DAYS + 30:
        print(f"  Insufficient test data ({len(test_df)} rows)")
        return {"error": "insufficient_data"}

    print(f"  Test period: {test_df.index[0].date()} to {test_df.index[-1].date()} ({len(test_df)} days)")

    # Compute predictions and conflict scores
    records = []
    for i in range(len(test_df) - FORWARD_DAYS):
        row = test_df.iloc[i]
        date = test_df.index[i]
        price = row.get("dxy_price", 0)

        if np.isnan(price) or price <= 0:
            continue

        # ML prediction
        X = row[FACTOR_COLS].values.reshape(1, -1)
        X = np.nan_to_num(X, nan=0.0, posinf=5.0, neginf=-5.0)
        ml_pred = float(model.predict(X)[0])

        # Proxy γ
        gamma = _proxy_gamma(row)

        # Conflict score
        conflict = _compute_conflict(gamma, ml_pred)

        # Actual forward return
        future_price = test_df.iloc[i + FORWARD_DAYS].get("dxy_price", price)
        if np.isnan(future_price) or future_price <= 0:
            continue
        actual_ret = (future_price - price) / price * 100

        # Signal classification
        g_dir = _gamma_direction(gamma)
        m_dir = _ml_direction(ml_pred)

        # Consensus type
        if g_dir == m_dir.replace("buy", "bull").replace("sell", "bear"):
            consensus = "full"
        elif g_dir == "neutral" or m_dir == "neutral":
            consensus = "partial"
        else:
            consensus = "conflict"

        records.append({
            "date": date.strftime("%Y-%m-%d"),
            "gamma": round(gamma, 1),
            "ml_pred": round(ml_pred, 4),
            "conflict": round(conflict, 4),
            "actual_ret": round(actual_ret, 4),
            "gamma_dir": g_dir,
            "ml_dir": m_dir,
            "consensus": consensus,
        })

    if not records:
        return {"error": "no_records"}

    df = pd.DataFrame(records)
    print(f"  Generated {len(df)} conflict-return pairs")

    # ── Analysis 1: Conflict buckets vs returns ─────────────────────────
    buckets = [
        {"label": "低冲突 (<0.2)", "min": 0.0, "max": 0.2},
        {"label": "中低 (0.2-0.4)", "min": 0.2, "max": 0.4},
        {"label": "中高 (0.4-0.6)", "min": 0.4, "max": 0.6},
        {"label": "高冲突 (>0.6)", "min": 0.6, "max": 1.01},
    ]

    bucket_stats = []
    for b in buckets:
        mask = (df["conflict"] >= b["min"]) & (df["conflict"] < b["max"])
        subset = df[mask]
        if len(subset) < 5:
            bucket_stats.append({
                "label": b["label"],
                "count": int(len(subset)),
                "avg_return": None,
                "std_return": None,
                "win_rate": None,
                "avg_abs_return": None,
            })
            continue

        avg_ret = float(subset["actual_ret"].mean())
        std_ret = float(subset["actual_ret"].std())
        # Win rate: was the ML direction correct?
        wins = 0
        for _, r in subset.iterrows():
            if r["ml_dir"] == "buy" and r["actual_ret"] > 0:
                wins += 1
            elif r["ml_dir"] == "sell" and r["actual_ret"] < 0:
                wins += 1
            elif r["ml_dir"] == "neutral":
                wins += 0.5  # Neutral gets half credit
        wr = wins / len(subset)

        bucket_stats.append({
            "label": b["label"],
            "count": int(len(subset)),
            "avg_return": round(avg_ret, 4),
            "std_return": round(std_ret, 4),
            "win_rate": round(wr, 4),
            "avg_abs_return": round(float(subset["actual_ret"].abs().mean()), 4),
        })

    print("  Conflict Buckets:")
    for bs in bucket_stats:
        if bs["avg_return"] is not None:
            print(f"    {bs['label']}: n={bs['count']}, avg_ret={bs['avg_return']:+.3f}%, "
                  f"std={bs['std_return']:.3f}%, wr={bs['win_rate']:.1%}")

    # ── Analysis 2: Consensus type attribution ──────────────────────────
    consensus_stats = []
    for ctype in ["full", "partial", "conflict"]:
        subset = df[df["consensus"] == ctype]
        if len(subset) < 3:
            continue

        # Compute strategy return: follow ML direction
        strat_rets = []
        for _, r in subset.iterrows():
            if r["ml_dir"] == "buy":
                strat_rets.append(r["actual_ret"])
            elif r["ml_dir"] == "sell":
                strat_rets.append(-r["actual_ret"])
            else:
                strat_rets.append(0)

        # 3.4 fix: scale returns to daily exposure (each 20d return contributes 1/20 per day)
        sr = np.array(strat_rets) / FORWARD_DAYS
        consensus_stats.append({
            "type": ctype,
            "label": {"full": "完全共识", "partial": "部分共识", "conflict": "信号矛盾"}[ctype],
            "count": int(len(subset)),
            "avg_strat_return": round(float(sr.mean() * FORWARD_DAYS), 4),  # display as per-trade
            "sharpe": round(float(sr.mean() / sr.std() * np.sqrt(252)) if sr.std() > 0 else 0, 4),
            "hit_rate": round(float((sr > 0).mean()), 4),
            "avg_conflict": round(float(subset["conflict"].mean()), 4),
        })

    print("  Consensus Attribution:")
    for cs in consensus_stats:
        print(f"    {cs['label']}: n={cs['count']}, ret={cs['avg_strat_return']:+.3f}%, "
              f"sharpe={cs['sharpe']:.2f}, hit={cs['hit_rate']:.1%}")

    # ── Analysis 3: Optimal threshold grid search ────────────────────────
    thresholds = np.arange(0.1, 0.9, 0.05)
    grid_results = []

    for thresh in thresholds:
        # Below threshold: follow 3×3 matrix (ML direction)
        # Above threshold: use conflict option (γ direction, 0.25× size)
        strat_rets = []
        for _, r in df.iterrows():
            if r["conflict"] >= thresh:
                # Conflict option: γ direction, 0.25× size
                if r["gamma"] >= 50:
                    ret = r["actual_ret"] * 0.25
                else:
                    ret = -r["actual_ret"] * 0.25
                # Apply wider stop conceptually (cap loss at 0.5×ATR equiv)
                ret = max(ret, -0.5)
            else:
                # Normal: ML direction, full size
                if r["ml_dir"] == "buy":
                    ret = r["actual_ret"]
                elif r["ml_dir"] == "sell":
                    ret = -r["actual_ret"]
                else:
                    ret = 0
            strat_rets.append(ret)

        # 3.4 fix: scale to daily exposure for proper Sharpe/NAV
        sr = np.array(strat_rets) / FORWARD_DAYS
        total_ret = float(sr.sum())  # cumulative daily P&L
        sharpe = float(sr.mean() / sr.std() * np.sqrt(252)) if sr.std() > 0 else 0
        max_dd = _compute_max_dd(sr)

        grid_results.append({
            "threshold": round(float(thresh), 2),
            "total_return": round(total_ret, 4),
            "sharpe": round(sharpe, 4),
            "max_drawdown": round(max_dd, 4),
            "conflict_pct": round(float((df["conflict"] >= thresh).mean() * 100), 1),
        })

    # Find optimal by Sharpe
    best = max(grid_results, key=lambda x: x["sharpe"])
    print(f"\n  Optimal Threshold: {best['threshold']:.2f} "
          f"(Sharpe={best['sharpe']:.3f}, Return={best['total_return']:+.2f}%, "
          f"MaxDD={best['max_drawdown']:.2%})")

    # ── Analysis 4: Conflict score time series ───────────────────────────
    # Subsample for dashboard display (max 200 points)
    step = max(1, len(df) // 200)
    time_series = []
    for i in range(0, len(df), step):
        r = df.iloc[i]
        time_series.append({
            "date": r["date"],
            "conflict": round(r["conflict"], 4),
            "actual_ret": round(r["actual_ret"], 4),
            "consensus": r["consensus"],
        })

    # ── Build output ─────────────────────────────────────────────────────
    result = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "test_period": {
            "start": df.iloc[0]["date"],
            "end": df.iloc[-1]["date"],
            "n_observations": int(len(df)),
        },
        "bucket_analysis": bucket_stats,
        "consensus_attribution": consensus_stats,
        "threshold_grid": grid_results,
        "optimal_threshold": best,
        "time_series": time_series,
        "soros_hypothesis": {
            "description": "冲突分数>0.6是否为regime转换的领先指标?",
            "high_conflict_pct": round(float((df["conflict"] > 0.6).mean() * 100), 1),
            "high_conflict_volatility": round(float(df[df["conflict"] > 0.6]["actual_ret"].std()), 4) if (df["conflict"] > 0.6).sum() > 3 else None,
            "low_conflict_volatility": round(float(df[df["conflict"] <= 0.3]["actual_ret"].std()), 4) if (df["conflict"] <= 0.3).sum() > 3 else None,
        },
    }

    _save_json(result, "conflict_backtest.json")

    print(f"\n[P2] Conflict Backtest Complete: {len(df)} observations, "
          f"optimal threshold={best['threshold']:.2f}")

    return result


def _compute_max_dd(returns):
    """Compute max drawdown from a return series."""
    cumulative = np.cumsum(returns) / 100 + 1
    peak = np.maximum.accumulate(cumulative)
    dd = (peak - cumulative) / peak
    return float(dd.max()) if len(dd) > 0 else 0.0


# ══════════════════════════════════════════════════════════════════════════
# Signal Router Performance Attribution
# ══════════════════════════════════════════════════════════════════════════

def run_signal_attribution(features_df):
    """
    Compare strategy performance across different routing modes:
      1. ML-only (baseline)
      2. γ-only
      3. 3×3 matrix (P0)
      4. 3×3 matrix + conflict option at optimal threshold (P0+)
      5. Full router with regime override (P0 complete)

    Output: signal_attribution.json
    """
    print("=" * 60)
    print("[P2] Signal Router Attribution")
    print("=" * 60)

    if not MODEL_PATH.exists():
        return {"error": "no_model"}

    model = XGBRegressor()
    model.load_model(str(MODEL_PATH))

    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    test_df = features_df[test_mask].copy()

    if len(test_df) < FORWARD_DAYS + 30:
        return {"error": "insufficient_data"}

    # Load optimal threshold
    opt_thresh = 0.6  # Default Soros threshold
    try:
        bt_path = OUTPUT_DIR / "conflict_backtest.json"
        if bt_path.exists():
            with open(bt_path) as f:
                bt_data = json.load(f)
            opt_thresh = bt_data.get("optimal_threshold", {}).get("threshold", 0.6)
    except Exception:
        pass

    # Strategy accumulators
    strategies = {
        "ml_only": {"returns": [], "label": "ML单引擎"},
        "gamma_only": {"returns": [], "label": "γ单引擎"},
        "matrix_3x3": {"returns": [], "label": "3×3矩阵 (P0)"},
        "matrix_conflict": {"returns": [], "label": f"3×3+冲突期权 (阈值={opt_thresh:.2f})"},
        "full_router": {"returns": [], "label": "完整路由 (P0+P1)"},
    }

    from regime_usd import detect_regime_v2

    for i in range(len(test_df) - FORWARD_DAYS):
        row = test_df.iloc[i]
        date = test_df.index[i]
        price = row.get("dxy_price", 0)
        if np.isnan(price) or price <= 0:
            continue

        X = row[FACTOR_COLS].values.reshape(1, -1)
        X = np.nan_to_num(X, nan=0.0, posinf=5.0, neginf=-5.0)
        ml_pred = float(model.predict(X)[0])
        gamma = _proxy_gamma(row)
        conflict = _compute_conflict(gamma, ml_pred)

        future_price = test_df.iloc[i + FORWARD_DAYS].get("dxy_price", price)
        if np.isnan(future_price) or future_price <= 0:
            continue
        actual_ret = (future_price - price) / price * 100

        g_dir = _gamma_direction(gamma)
        m_dir = _ml_direction(ml_pred)

        # Strategy 1: ML only
        if m_dir == "buy":
            strategies["ml_only"]["returns"].append(actual_ret)
        elif m_dir == "sell":
            strategies["ml_only"]["returns"].append(-actual_ret)
        else:
            strategies["ml_only"]["returns"].append(0)

        # Strategy 2: γ only
        if g_dir == "bull":
            strategies["gamma_only"]["returns"].append(actual_ret)
        elif g_dir == "bear":
            strategies["gamma_only"]["returns"].append(-actual_ret)
        else:
            strategies["gamma_only"]["returns"].append(0)

        # Strategy 3: 3×3 matrix (always follow consensus)
        if g_dir == m_dir.replace("buy", "bull").replace("sell", "bear"):
            # Full consensus
            if m_dir == "buy":
                strategies["matrix_3x3"]["returns"].append(actual_ret)
            else:
                strategies["matrix_3x3"]["returns"].append(-actual_ret)
        elif g_dir == "neutral" or m_dir == "neutral":
            # Partial: half size
            if m_dir == "buy" or g_dir == "bull":
                strategies["matrix_3x3"]["returns"].append(actual_ret * 0.5)
            elif m_dir == "sell" or g_dir == "bear":
                strategies["matrix_3x3"]["returns"].append(-actual_ret * 0.5)
            else:
                strategies["matrix_3x3"]["returns"].append(0)
        else:
            # Conflict: flat in basic matrix
            strategies["matrix_3x3"]["returns"].append(0)

        # Strategy 4: Matrix + conflict option at threshold
        if conflict >= opt_thresh:
            # Conflict option: γ direction, 0.25× size
            if gamma >= 50:
                strategies["matrix_conflict"]["returns"].append(actual_ret * 0.25)
            else:
                strategies["matrix_conflict"]["returns"].append(-actual_ret * 0.25)
        else:
            # Same as matrix_3x3
            strategies["matrix_conflict"]["returns"].append(
                strategies["matrix_3x3"]["returns"][-1]
            )

        # Strategy 5: Full router with regime override
        try:
            row_idx = features_df.index.get_loc(date)
            regime = detect_regime_v2(features_df, row_idx=row_idx)
            regime_mult = regime.get("multiplier", 1.0)
        except Exception:
            regime_mult = 1.0

        vix_z = row.get("F4_VIX", 0) if not np.isnan(row.get("F4_VIX", 0)) else 0

        if vix_z > 3.0 or regime_mult <= 0.3:
            # Crisis: flat
            strategies["full_router"]["returns"].append(0)
        elif conflict > 0.6:
            # Transition: conflict option
            if gamma >= 50:
                strategies["full_router"]["returns"].append(actual_ret * 0.25)
            else:
                strategies["full_router"]["returns"].append(-actual_ret * 0.25)
        elif regime_mult <= 0.65:
            # Policy shock: γ only, 0.5× size
            if g_dir == "bull":
                strategies["full_router"]["returns"].append(actual_ret * 0.5)
            elif g_dir == "bear":
                strategies["full_router"]["returns"].append(-actual_ret * 0.5)
            else:
                strategies["full_router"]["returns"].append(0)
        else:
            # Normal: matrix, adjusted by regime mult
            base_ret = strategies["matrix_conflict"]["returns"][-1]
            strategies["full_router"]["returns"].append(base_ret * min(regime_mult, 1.2))

    # ── 3.4 Fix: Frequency-aligned P&L computation ─────────────────────
    # The model predicts 20-day forward returns. Taking a daily signal and
    # applying the full 20d return creates 20 overlapping positions
    # (equivalent to 20× leverage). Scale each daily return by 1/FORWARD_DAYS
    # so that the total daily exposure equals one full position.
    #
    # Mathematically: at any day t, the effective position is the average of
    # the last 20 days' signals. Daily P&L = (1/20) × 20d_return × signal.
    # This is the standard "overlapping windows" correction for attribution.
    SCALE = 1.0 / FORWARD_DAYS

    # Compute statistics
    results = []
    for key, strat in strategies.items():
        rets = np.array(strat["returns"])
        if len(rets) == 0:
            continue

        # Apply frequency correction: each daily signal holds 1/20 position
        daily_rets = rets * SCALE

        total_ret = float(daily_rets.sum())
        avg_ret = float(daily_rets.mean())
        std_ret = float(daily_rets.std()) if daily_rets.std() > 0 else 0.001
        # Sharpe annualized on daily basis (252 trading days/year)
        sharpe = avg_ret / std_ret * np.sqrt(252) if std_ret > 0 else 0
        max_dd = _compute_max_dd(daily_rets)
        hit_rate = float((rets > 0).mean())  # hit rate still based on 20d direction

        # Cumulative NAV with realistic compounding
        nav = np.cumprod(1 + daily_rets / 100)
        step = max(1, len(nav) // 100)
        nav_series = [round(float(nav[j]), 4) for j in range(0, len(nav), step)]

        results.append({
            "strategy": key,
            "label": strat["label"],
            "total_return": round(total_ret, 4),
            "sharpe": round(float(sharpe), 4),
            "max_drawdown": round(max_dd, 4),
            "hit_rate": round(hit_rate, 4),
            "n_trades": int(len(rets)),
            "nav_series": nav_series,
        })

        print(f"  {strat['label']}: ret={total_ret:+.2f}%, sharpe={sharpe:.3f}, "
              f"maxDD={max_dd:.2%}, hit={hit_rate:.1%}")

    output = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "strategies": results,
        "optimal_threshold": opt_thresh,
    }

    _save_json(output, "signal_attribution.json")
    return output


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    run_conflict_backtest(features)
    run_signal_attribution(features)
