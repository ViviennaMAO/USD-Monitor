"""
USD Monitor Phase 2 — XGBoost Model Training
Purged Time-Series CV, IC history, model health diagnostics.
"""
import json
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from scipy.stats import spearmanr

from config_v2 import (
    XGB_PARAMS, FACTOR_COLS, FACTOR_DISPLAY, FACTOR_SHORT_IDS,
    FORWARD_DAYS, TRAIN_END, MODEL_PATH, OUTPUT_DIR,
    REGIME_DATE_LABELS, IC_WINDOW,
    CV_MODE, CV_WINDOW_DAYS, CV_N_SPLITS,
    SAMPLE_WEIGHT_DECAY, SAMPLE_WEIGHT_HALFLIFE_DAYS,
)


# ── Purged Time-Series Split ──────────────────────────────────────────────

class PurgedTimeSeriesSplit:
    """
    Time-series cross-validation with purge gap to prevent look-ahead bias.
    The purge gap equals FORWARD_DAYS to prevent target leakage.

    Modes:
      - "expanding": train[0:train_end] (old, regime-diluted by ancient data)
      - "sliding":   train[train_end-window : train_end] (regime-sensitive)
    """
    def __init__(self, n_splits: int = CV_N_SPLITS, purge_gap: int = FORWARD_DAYS,
                 mode: str = CV_MODE, window: int = CV_WINDOW_DAYS):
        self.n_splits = n_splits
        self.purge_gap = purge_gap
        self.mode = mode
        self.window = window

    def split(self, X):
        n = len(X)
        fold_size = n // (self.n_splits + 1)
        for i in range(self.n_splits):
            train_end = fold_size * (i + 1)
            val_start = train_end + self.purge_gap
            val_end = min(val_start + fold_size, n)
            if val_start >= n or val_end <= val_start:
                continue

            if self.mode == "sliding":
                # Only use most recent `window` days for training
                train_start = max(0, train_end - self.window)
                train_idx = np.arange(train_start, train_end)
            else:
                # expanding (old behavior)
                train_idx = np.arange(0, train_end)

            val_idx = np.arange(val_start, val_end)
            yield train_idx, val_idx


# ── Sample Weight Decay (3.3: give recent samples more weight) ────────────

def compute_sample_weights(dates, halflife_days: int = SAMPLE_WEIGHT_HALFLIFE_DAYS) -> np.ndarray:
    """
    Exponential recency weights: w_i = 0.5 ** ((t_last - t_i) / halflife).
    The most recent sample has weight 1.0, older samples decay.

    Half-life of 504d (2 years) means:
      - samples 2y  old → weight 0.50
      - samples 4y  old → weight 0.25
      - samples 10y old → weight 0.03
    """
    if not SAMPLE_WEIGHT_DECAY or len(dates) == 0:
        return np.ones(len(dates))

    last_date = dates[-1]
    days_from_last = np.array([(last_date - d).days for d in dates], dtype=float)
    weights = np.power(0.5, days_from_last / halflife_days)
    return weights


# ── NaN-safe JSON encoder ─────────────────────────────────────────────────

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


# ── Regime Label Helper ───────────────────────────────────────────────────

def _get_regime_label(date: pd.Timestamp) -> str:
    for cutoff, label in REGIME_DATE_LABELS:
        if cutoff is None:
            return label
        if date <= pd.Timestamp(cutoff):
            return label
    return REGIME_DATE_LABELS[-1][1]


# ── IC Tracking (per-factor JSON for API) ─────────────────────────────────

def compute_ic_tracking(features_df: pd.DataFrame, model: XGBRegressor):
    """
    Compute per-factor IC tracking files for the Phase 2 API.
    Output: ic_tracking_F1.json through ic_tracking_F10.json
    Matches IcTrackingData interface in types/index.ts.
    """
    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    df = features_df[test_mask].dropna(subset=["target"])

    if len(df) < IC_WINDOW:
        print(f"[ic_tracking] Insufficient OOS data ({len(df)} rows)")
        return

    X = df[FACTOR_COLS].values
    y = df["target"].values
    dates = df.index
    preds = model.predict(X)

    for j, factor_col in enumerate(FACTOR_COLS):
        short_id = FACTOR_SHORT_IDS[factor_col]
        display_name = FACTOR_DISPLAY[factor_col]
        factor_vals = X[:, j]

        # Rolling IC history
        window = min(IC_WINDOW, len(df) // 2)
        history = []
        ic_values = []

        for i in range(window, len(dates)):
            segment = factor_vals[i - window:i]
            target_segment = y[i - window:i]

            # Factor IC: correlation between factor value and actual return
            ic, _ = spearmanr(segment, target_segment)
            ic = float(ic) if not np.isnan(ic) else 0.0
            ic_values.append(ic)

            # 20-day MA of IC
            ic_ma20 = float(np.mean(ic_values[-20:])) if len(ic_values) >= 20 else ic

            history.append({
                "date": dates[i].strftime("%Y-%m-%d"),
                "ic": round(ic, 4),
                "ic_ma20": round(ic_ma20, 4),
                "regime": _get_regime_label(dates[i]),
            })

        # ICIR = mean(IC) / std(IC)
        ic_arr = np.array(ic_values)
        icir = float(ic_arr.mean() / ic_arr.std()) if ic_arr.std() > 0 else 0.0

        tracking_data = {
            "factor": short_id,
            "factor_name": display_name,
            "ic_today": history[-1]["ic"] if history else 0.0,
            "ic_ma20": history[-1]["ic_ma20"] if history else 0.0,
            "icir": round(icir, 2),
            "history": history,
        }

        _save_json(tracking_data, f"ic_tracking_{short_id}.json")

    print(f"[ic_tracking] Generated {len(FACTOR_COLS)} IC tracking files")


# ── IC History (overall model IC) ─────────────────────────────────────────

def compute_ic_history(features_df: pd.DataFrame, model: XGBRegressor):
    """
    Compute rolling model-level IC and per-factor IC.
    Output: ic_history.json
    """
    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    df = features_df[test_mask].dropna(subset=["target"])

    X = df[FACTOR_COLS].values
    y = df["target"].values
    dates = df.index
    preds = model.predict(X)

    # Overall OOS IC
    oos_ic, _ = spearmanr(preds, y)

    # Rolling IC
    window = min(IC_WINDOW, len(df) // 2)
    rolling_ic = []
    for i in range(window, len(dates)):
        ic, _ = spearmanr(preds[i - window:i], y[i - window:i])
        rolling_ic.append({
            "date": dates[i].strftime("%Y-%m-%d"),
            "ic": round(float(ic) if not np.isnan(ic) else 0.0, 4),
        })

    # Per-factor IC
    factor_ic = []
    for j, col in enumerate(FACTOR_COLS):
        ic, _ = spearmanr(X[:, j], y)
        factor_ic.append({
            "factor": col,
            "ic": round(float(ic) if not np.isnan(ic) else 0.0, 4),
        })

    result = {
        "oos_ic": round(float(oos_ic) if not np.isnan(oos_ic) else 0.0, 4),
        "rolling_ic": rolling_ic,
        "factor_ic": factor_ic,
    }

    _save_json(result, "ic_history.json")
    return result


# ── Model Health ──────────────────────────────────────────────────────────

def compute_model_health(features_df: pd.DataFrame, model: XGBRegressor):
    """
    Assess model health: OOS IC, trend, multicollinearity.
    Output: model_health.json
    """
    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    df = features_df[test_mask].dropna(subset=["target"])

    X = df[FACTOR_COLS].values
    y = df["target"].values
    preds = model.predict(X)

    # Overall IC
    oos_ic, _ = spearmanr(preds, y)
    oos_ic = float(oos_ic) if not np.isnan(oos_ic) else 0.0

    # Recent 60d IC
    recent_n = min(IC_WINDOW, len(df))
    recent_ic, _ = spearmanr(preds[-recent_n:], y[-recent_n:])
    recent_ic = float(recent_ic) if not np.isnan(recent_ic) else 0.0

    # IC trend (first half vs second half)
    mid = len(preds) // 2
    ic_first, _ = spearmanr(preds[:mid], y[:mid]) if mid > 20 else (0, 0)
    ic_second, _ = spearmanr(preds[mid:], y[mid:]) if mid > 20 else (0, 0)
    ic_first = float(ic_first) if not np.isnan(ic_first) else 0.0
    ic_second = float(ic_second) if not np.isnan(ic_second) else 0.0

    # Per-factor IC
    factor_ics = {}
    for j, col in enumerate(FACTOR_COLS):
        ic, _ = spearmanr(X[:, j], y)
        factor_ics[col] = round(float(ic) if not np.isnan(ic) else 0.0, 4)

    # Multicollinearity check
    warnings = []
    corr_matrix = np.corrcoef(X.T)
    for i in range(len(FACTOR_COLS)):
        for j in range(i + 1, len(FACTOR_COLS)):
            r = abs(corr_matrix[i, j])
            if r > 0.7:
                warnings.append(
                    f"High correlation: {FACTOR_COLS[i]} × {FACTOR_COLS[j]} = {r:.2f}"
                )

    # Status
    if oos_ic > 0.10:
        status = "healthy"
    elif oos_ic > 0.05:
        status = "warning"
    elif len(df) < 30:
        status = "insufficient_data"
    else:
        status = "degraded"

    result = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "oos_ic": round(oos_ic, 4),
        "recent_60d_ic": round(recent_ic, 4),
        "ic_first_half": round(ic_first, 4),
        "ic_second_half": round(ic_second, 4),
        "factor_ics": factor_ics,
        "status": status,
        "warnings": warnings,
    }

    _save_json(result, "model_health.json")
    print(f"[health] Status: {status}, OOS IC: {oos_ic:.4f}, Recent IC: {recent_ic:.4f}")
    return result


# ── Regime-Conditional Factor Gate (3.3) ──────────────────────────────────

def compute_regime_factor_mask(features_df: pd.DataFrame):
    """
    Compute a factor mask per regime using training-set IC.
    Factors with IC < REGIME_FACTOR_MIN_IC in a given regime are masked out
    (set to 0) at inference time when that regime is active.

    Output: regime_factor_mask.json
      {
        "regimes": ["加息期", "降息期", "震荡期"],
        "masks": {
          "加息期": {"F1_RateDiff": 1.0, "F2_RealRateDelta": 0.0, ...},
          ...
        },
        "factor_regime_ic": {...},
        "min_ic_threshold": -0.15
      }
    """
    from config_v2 import REGIME_FACTOR_GATE, REGIME_FACTOR_MIN_IC, REGIME_FACTOR_MIN_OBS

    if not REGIME_FACTOR_GATE:
        return None

    train_mask = features_df.index <= pd.Timestamp(TRAIN_END)
    df = features_df[train_mask].dropna(subset=["target"]).copy()

    # Label each row with regime
    df["regime"] = [_get_regime_label(d) for d in df.index]
    regimes = sorted(df["regime"].unique().tolist())

    masks = {}
    factor_regime_ic = {}

    for regime in regimes:
        sub = df[df["regime"] == regime]
        if len(sub) < REGIME_FACTOR_MIN_OBS:
            # Not enough data → no mask (all factors allowed)
            masks[regime] = {f: 1.0 for f in FACTOR_COLS}
            factor_regime_ic[regime] = {f: None for f in FACTOR_COLS}
            continue

        regime_ic = {}
        regime_mask = {}
        for f in FACTOR_COLS:
            ic, _ = spearmanr(sub[f].values, sub["target"].values)
            ic = float(ic) if not np.isnan(ic) else 0.0
            regime_ic[f] = round(ic, 4)
            # Mask factor if its IC is too negative in this regime
            regime_mask[f] = 0.0 if ic < REGIME_FACTOR_MIN_IC else 1.0

        masks[regime] = regime_mask
        factor_regime_ic[regime] = regime_ic

    result = {
        "timestamp": pd.Timestamp.now().isoformat(),
        "regimes": regimes,
        "masks": masks,
        "factor_regime_ic": factor_regime_ic,
        "min_ic_threshold": REGIME_FACTOR_MIN_IC,
        "min_obs_per_regime": REGIME_FACTOR_MIN_OBS,
    }

    _save_json(result, "regime_factor_mask.json")

    # Print summary
    print(f"[regime_gate] Factor masks computed for {len(regimes)} regimes:")
    for regime in regimes:
        masked = [f.split("_")[0] for f, v in masks[regime].items() if v == 0.0]
        active = [f.split("_")[0] for f, v in masks[regime].items() if v == 1.0]
        print(f"  {regime}: active={len(active)}/10, masked={masked if masked else 'none'}")

    return result


# ── Main Training Flow ────────────────────────────────────────────────────

def train_model(features_df: pd.DataFrame) -> XGBRegressor:
    """
    Full training pipeline:
    1. Purged CV on training data
    2. Train final model
    3. Compute IC history + tracking
    4. Run CPCV and multi-scale (if available)
    """
    print("=" * 60)
    print("[train] USD Monitor XGBoost Training")
    print("=" * 60)

    # Split train/test
    train_mask = features_df.index <= pd.Timestamp(TRAIN_END)
    train_df = features_df[train_mask].dropna(subset=["target"])
    test_df = features_df[~train_mask].dropna(subset=["target"])

    print(f"[train] Train: {len(train_df)} rows ({train_df.index.min()} to {train_df.index.max()})")
    print(f"[train] Test:  {len(test_df)} rows ({test_df.index.min()} to {test_df.index.max()})")

    X_train = train_df[FACTOR_COLS].values
    y_train = train_df["target"].values
    X_test = test_df[FACTOR_COLS].values
    y_test = test_df["target"].values

    # Replace inf/nan
    X_train = np.nan_to_num(X_train, nan=0.0, posinf=5.0, neginf=-5.0)
    X_test = np.nan_to_num(X_test, nan=0.0, posinf=5.0, neginf=-5.0)

    # Compute sample weights for recency decay
    train_dates = train_df.index
    sample_weights_all = compute_sample_weights(train_dates)
    print(f"[train] Sample weight decay: enabled={SAMPLE_WEIGHT_DECAY}, "
          f"halflife={SAMPLE_WEIGHT_HALFLIFE_DAYS}d, "
          f"oldest_weight={sample_weights_all[0]:.3f}, newest_weight={sample_weights_all[-1]:.3f}")

    # ── Step 1: Purged CV (sliding window + sample weights) ───────────
    print(f"\n[train] Purged Time-Series CV ({CV_N_SPLITS}-fold, {FORWARD_DAYS}-day gap, "
          f"mode={CV_MODE}, window={CV_WINDOW_DAYS}d):")
    cv = PurgedTimeSeriesSplit(
        n_splits=CV_N_SPLITS,
        purge_gap=FORWARD_DAYS,
        mode=CV_MODE,
        window=CV_WINDOW_DAYS,
    )
    cv_ics = []
    for fold, (tr_idx, val_idx) in enumerate(cv.split(X_train)):
        m = XGBRegressor(**XGB_PARAMS)
        fold_weights = sample_weights_all[tr_idx]
        m.fit(
            X_train[tr_idx], y_train[tr_idx],
            sample_weight=fold_weights,
            verbose=False,
        )
        val_preds = m.predict(X_train[val_idx])
        ic, _ = spearmanr(val_preds, y_train[val_idx])
        ic = float(ic) if not np.isnan(ic) else 0.0
        cv_ics.append(ic)
        print(f"  Fold {fold+1}: IC = {ic:.4f} (train={len(tr_idx)}, val={len(val_idx)})")
    print(f"  Mean CV IC: {np.mean(cv_ics):.4f}")

    # ── Step 2: Train final model (with sample weights) ──────────────
    print("\n[train] Training final model on full training set...")
    model = XGBRegressor(**XGB_PARAMS)
    model.fit(
        X_train, y_train,
        sample_weight=sample_weights_all,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # Test IC
    test_preds = model.predict(X_test)
    test_ic, _ = spearmanr(test_preds, y_test)
    print(f"[train] OOS Test IC: {test_ic:.4f}")

    # Save model
    model.save_model(str(MODEL_PATH))
    print(f"[train] Model saved to {MODEL_PATH}")

    # ── Step 3: IC history + tracking ──────────────────────────────────
    print("\n[train] Computing IC history...")
    compute_ic_history(features_df, model)

    print("[train] Computing IC tracking per factor...")
    compute_ic_tracking(features_df, model)

    print("[train] Computing model health...")
    compute_model_health(features_df, model)

    # ── Step 3b: Regime-conditional factor mask (3.3 fix) ─────────────
    print("[train] Computing regime-conditional factor mask...")
    compute_regime_factor_mask(features_df)

    # ── Step 4: CPCV (optional) ────────────────────────────────────────
    try:
        from cpcv import run_cpcv_validation
        print("\n[train] Running CPCV validation...")
        cpcv_result = run_cpcv_validation(features_df)
        _save_json(cpcv_result, "cpcv_result.json")
    except Exception as e:
        print(f"[train] CPCV skipped: {e}")

    # ── Step 5: Multi-scale (optional) ─────────────────────────────────
    try:
        from multiscale import train_multiscale_models
        print("\n[train] Training multi-scale models...")
        ms_result = train_multiscale_models(features_df)
        _save_json(ms_result, "multiscale_result.json")
    except Exception as e:
        print(f"[train] Multi-scale skipped: {e}")

    print("\n[train] Training complete!")
    return model


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    model = train_model(features)
