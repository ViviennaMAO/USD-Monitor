"""
USD Monitor Phase 2 — Daily Inference
Loads trained model, generates SHAP attribution, regime detection,
correlation matrix, and all JSON outputs for the dashboard API.
"""
import json
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from scipy.stats import spearmanr

from config_v2 import (
    ALL_FACTOR_COLS_PRUNED as FACTOR_COLS,
    FACTOR_DISPLAY, ALL_SHORT_IDS as FACTOR_SHORT_IDS,
    MODEL_PATH, OUTPUT_DIR, TRAIN_END,
    SIGNAL_THRESHOLDS, REGIME_DATE_LABELS,
)


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


def _get_regime_label(date: pd.Timestamp) -> str:
    for cutoff, label in REGIME_DATE_LABELS:
        if cutoff is None:
            return label
        if date <= pd.Timestamp(cutoff):
            return label
    return REGIME_DATE_LABELS[-1][1]


def _load_regime_factor_mask():
    """Load per-regime factor mask from regime_factor_mask.json (if exists)."""
    path = OUTPUT_DIR / "regime_factor_mask.json"
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def _apply_regime_mask(X: np.ndarray, current_regime: str, mask_data: dict) -> tuple:
    """
    Apply regime-conditional factor mask to feature vector X.
    Factors with mask=0.0 in current regime are zeroed out.

    Returns: (X_masked, masked_factors_list)
    """
    if mask_data is None or current_regime not in mask_data.get("masks", {}):
        return X, []

    mask_dict = mask_data["masks"][current_regime]
    masked_factors = []
    X_out = X.copy()
    for j, factor in enumerate(FACTOR_COLS):
        if mask_dict.get(factor, 1.0) == 0.0:
            X_out[:, j] = 0.0
            masked_factors.append(factor)
    return X_out, masked_factors


# ── Signal Grade ───────────────────────────────────────────────────────────

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


# ══════════════════════════════════════════════════════════════════════════
# SHAP Attribution → shap.json
# ══════════════════════════════════════════════════════════════════════════

def compute_shap(model: XGBRegressor, features_df: pd.DataFrame) -> dict:
    """
    SHAP TreeExplainer on the latest row.
    Output matches ShapData interface in types/index.ts:262.
    """
    import shap

    row = features_df.iloc[-1]
    X_latest = row[FACTOR_COLS].values.reshape(1, -1)
    X_latest = np.nan_to_num(X_latest, nan=0.0, posinf=5.0, neginf=-5.0)

    # TreeExplainer for XGBoost
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_latest)

    base_value = float(explainer.expected_value)
    output_value = float(base_value + shap_values[0].sum())

    factors = []
    for j, col in enumerate(FACTOR_COLS):
        factors.append({
            "name": FACTOR_DISPLAY[col],
            "shap_value": round(float(shap_values[0][j]), 6),
            "factor_value": round(float(X_latest[0][j]), 4),
        })

    # Sort by absolute SHAP value (largest impact first)
    factors.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    result = {
        "base_value": round(base_value, 6),
        "output_value": round(output_value, 6),
        "date": features_df.index[-1].strftime("%Y-%m-%d"),
        "factors": factors,
    }

    _save_json(result, "shap.json")

    # SHAP stability check (10-day)
    _check_shap_stability(model, features_df)

    return result


def _check_shap_stability(model: XGBRegressor, features_df: pd.DataFrame):
    """Flag if dominant SHAP factor > 60% over last 10 days."""
    import shap

    n_days = min(10, len(features_df))
    recent = features_df.iloc[-n_days:]
    X_recent = recent[FACTOR_COLS].values
    X_recent = np.nan_to_num(X_recent, nan=0.0, posinf=5.0, neginf=-5.0)

    explainer = shap.TreeExplainer(model)
    shap_vals = explainer.shap_values(X_recent)

    # Mean absolute SHAP per factor over 10 days
    mean_abs = np.abs(shap_vals).mean(axis=0)
    total = mean_abs.sum()
    if total > 0:
        dominance = mean_abs / total
        max_idx = dominance.argmax()
        if dominance[max_idx] > 0.60:
            print(f"  ⚠ SHAP stability warning: {FACTOR_COLS[max_idx]} dominates "
                  f"at {dominance[max_idx]:.0%} over 10 days")


# ══════════════════════════════════════════════════════════════════════════
# Regime IC Heatmap → regime_ic.json
# ══════════════════════════════════════════════════════════════════════════

def compute_regime_ic(features_df: pd.DataFrame) -> dict:
    """
    Per-factor Spearman IC broken down by regime period.
    Output matches RegimeIcData interface in types/index.ts:270.
    """
    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    df = features_df[test_mask].dropna(subset=["target"])

    if len(df) < 30:
        print("[regime_ic] Insufficient OOS data")
        return {}

    # Assign regime labels
    df = df.copy()
    df["regime"] = df.index.map(_get_regime_label)
    regimes = list(df["regime"].unique())

    factors = [FACTOR_SHORT_IDS[col] for col in FACTOR_COLS]
    factor_names = [FACTOR_DISPLAY[col] for col in FACTOR_COLS]

    # matrix[factor_idx][regime_idx] = IC
    matrix = []
    for col in FACTOR_COLS:
        row_ics = []
        for regime in regimes:
            mask = df["regime"] == regime
            subset = df[mask]
            if len(subset) < 20:
                row_ics.append(0.0)
                continue
            ic, _ = spearmanr(subset[col].values, subset["target"].values)
            ic = float(ic) if not np.isnan(ic) else 0.0
            row_ics.append(round(ic, 4))
        matrix.append(row_ics)

    result = {
        "regimes": regimes,
        "factors": factors,
        "factor_names": factor_names,
        "matrix": matrix,
    }

    _save_json(result, "regime_ic.json")
    return result


# ══════════════════════════════════════════════════════════════════════════
# Correlation Matrix → correlation.json
# ══════════════════════════════════════════════════════════════════════════

def compute_correlation(features_df: pd.DataFrame) -> dict:
    """
    Pairwise correlation matrix of all 10 factors.
    Output matches CorrelationData interface in types/index.ts:278.
    """
    df = features_df[FACTOR_COLS].dropna()
    corr = df.corr(method="spearman").values

    labels = [FACTOR_SHORT_IDS[col] for col in FACTOR_COLS]
    full_labels = [FACTOR_DISPLAY[col] for col in FACTOR_COLS]

    # Round to 4 decimal places
    matrix = [[round(float(corr[i][j]), 4) for j in range(len(FACTOR_COLS))]
              for i in range(len(FACTOR_COLS))]

    result = {
        "labels": labels,
        "full_labels": full_labels,
        "matrix": matrix,
    }

    _save_json(result, "correlation.json")
    return result


# ══════════════════════════════════════════════════════════════════════════
# Full Inference Pipeline
# ══════════════════════════════════════════════════════════════════════════

def run_inference(features_df: pd.DataFrame) -> dict:
    """
    Full daily inference:
    1. Load model
    2. Predict latest signal
    3. SHAP attribution
    4. Regime detection
    5. Regime IC heatmap
    6. Correlation matrix
    """
    print("=" * 60)
    print("[inference] USD Monitor Daily Inference")
    print("=" * 60)

    # Load model
    if not MODEL_PATH.exists():
        print(f"[inference] Model not found at {MODEL_PATH}, training first...")
        from train import train_model
        model = train_model(features_df)
    else:
        model = XGBRegressor()
        model.load_model(str(MODEL_PATH))
        print(f"[inference] Loaded model from {MODEL_PATH}")

    # Latest prediction
    row = features_df.iloc[-1]
    X_latest = row[FACTOR_COLS].values.reshape(1, -1)
    X_latest = np.nan_to_num(X_latest, nan=0.0, posinf=5.0, neginf=-5.0)

    # Regime detection (must happen before prediction for regime-gating)
    from regime_usd import detect_regime_v2
    regime = detect_regime_v2(features_df, row_idx=-1)
    print(f"[inference] Regime: {regime['regime']} (mult={regime['multiplier']})")

    # Regime-conditional factor mask (3.3)
    current_regime_label = _get_regime_label(features_df.index[-1])
    mask_data = _load_regime_factor_mask()
    X_for_pred, masked_factors = _apply_regime_mask(X_latest, current_regime_label, mask_data)
    if masked_factors:
        print(f"[inference] Regime gate active ({current_regime_label}): "
              f"masked {len(masked_factors)} factors: {[f.split('_')[0] for f in masked_factors]}")

    pred_raw = float(model.predict(X_latest)[0])
    pred = float(model.predict(X_for_pred)[0])
    grade = _signal_grade(pred)
    print(f"[inference] Prediction: {pred:+.4f}% (20d), Grade: {grade}")
    if masked_factors:
        print(f"[inference]   (raw pred without mask: {pred_raw:+.4f}%, mask delta: {pred-pred_raw:+.4f}%)")
    print(f"[inference] Date: {features_df.index[-1].strftime('%Y-%m-%d')}")

    # SHAP
    print("\n[inference] Computing SHAP attribution...")
    shap_result = compute_shap(model, features_df)

    # Regime IC heatmap
    print("[inference] Computing regime IC matrix...")
    regime_ic = compute_regime_ic(features_df)

    # Correlation matrix
    print("[inference] Computing factor correlation...")
    correlation = compute_correlation(features_df)

    # Summary output
    summary = {
        "date": features_df.index[-1].strftime("%Y-%m-%d"),
        "prediction": round(pred, 4),
        "signal_grade": grade,
        "regime": regime,
        "dxy_price": round(float(row.get("dxy_price", 0)), 2),
    }

    _save_json(summary, "inference_summary.json")

    print(f"\n[inference] Complete. Signal: {grade} ({pred:+.4f}%)")
    return summary


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    result = run_inference(features)
    print(f"\n=== Inference Summary ===")
    for k, v in result.items():
        print(f"  {k}: {v}")
