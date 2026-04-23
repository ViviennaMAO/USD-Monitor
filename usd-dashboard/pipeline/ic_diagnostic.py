"""
USD Monitor Phase 2 — IC Diagnostics
Multi-target IC matrix, multi-window IC, leave-one-out ablation.
"""
import json
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from scipy.stats import spearmanr

from config_v2 import (
    ALL_FACTOR_COLS_PRUNED as FACTOR_COLS,
    FACTOR_DISPLAY, ALL_SHORT_IDS as FACTOR_SHORT_IDS,
    XGB_PARAMS, FORWARD_DAYS, TRAIN_END, OUTPUT_DIR,
    HORIZONS,
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
        return super().default(obj)


def _save_json(data, filename):
    path = OUTPUT_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, cls=NaNSafeEncoder, ensure_ascii=False, indent=2)
    print(f"  → {path}")


def multi_target_ic_matrix(features_df: pd.DataFrame) -> dict:
    """
    Compute IC for each factor against multiple horizon targets.
    Matrix: factors × horizons.
    """
    print("[ic_diag] Computing multi-target IC matrix...")

    df = features_df.copy()
    price = df["dxy_price"]

    # Build multi-horizon targets
    horizon_targets = {}
    for h in HORIZONS:
        col = f"target_{h}d"
        df[col] = (price.shift(-h) / price - 1) * 100
        horizon_targets[h] = col

    # Use test data only
    test_mask = df.index > pd.Timestamp(TRAIN_END)
    test_df = df[test_mask]

    matrix = {}
    for col in FACTOR_COLS:
        short_id = FACTOR_SHORT_IDS[col]
        matrix[short_id] = {}
        for h, target_col in horizon_targets.items():
            subset = test_df[[col, target_col]].dropna()
            if len(subset) < 30:
                matrix[short_id][f"{h}d"] = 0.0
                continue
            ic, _ = spearmanr(subset[col].values, subset[target_col].values)
            matrix[short_id][f"{h}d"] = round(float(ic) if not np.isnan(ic) else 0.0, 4)

    return matrix


def multi_window_ic(features_df: pd.DataFrame) -> dict:
    """
    Compute factor IC across different rolling windows (30d, 60d, 120d, 252d).
    """
    print("[ic_diag] Computing multi-window IC...")

    test_mask = features_df.index > pd.Timestamp(TRAIN_END)
    df = features_df[test_mask].dropna(subset=["target"])

    windows = [30, 60, 120, 252]
    result = {}

    for col in FACTOR_COLS:
        short_id = FACTOR_SHORT_IDS[col]
        result[short_id] = {}
        for w in windows:
            n = min(w, len(df))
            if n < 20:
                result[short_id][f"{w}d"] = 0.0
                continue
            subset = df.iloc[-n:]
            ic, _ = spearmanr(subset[col].values, subset["target"].values)
            result[short_id][f"{w}d"] = round(float(ic) if not np.isnan(ic) else 0.0, 4)

    return result


def leave_one_out_ablation(features_df: pd.DataFrame) -> dict:
    """
    Leave-one-out factor ablation: train model without each factor,
    compare IC to full model. Identifies critical vs redundant factors.
    """
    print("[ic_diag] Running leave-one-out ablation...")

    train_mask = features_df.index <= pd.Timestamp(TRAIN_END)
    test_mask = ~train_mask

    train_df = features_df[train_mask].dropna(subset=["target"])
    test_df = features_df[test_mask].dropna(subset=["target"])

    if len(train_df) < 200 or len(test_df) < 30:
        print("[ic_diag] Insufficient data for ablation")
        return {}

    y_train = train_df["target"].values
    y_test = test_df["target"].values

    # Full model IC
    X_train_full = np.nan_to_num(train_df[FACTOR_COLS].values, nan=0.0)
    X_test_full = np.nan_to_num(test_df[FACTOR_COLS].values, nan=0.0)

    full_model = XGBRegressor(**XGB_PARAMS)
    full_model.fit(X_train_full, y_train, verbose=False)
    full_preds = full_model.predict(X_test_full)
    full_ic, _ = spearmanr(full_preds, y_test)
    full_ic = float(full_ic) if not np.isnan(full_ic) else 0.0

    # Leave-one-out
    ablation = {"full_ic": round(full_ic, 4), "factors": {}}
    for drop_col in FACTOR_COLS:
        remaining = [c for c in FACTOR_COLS if c != drop_col]
        X_train = np.nan_to_num(train_df[remaining].values, nan=0.0)
        X_test = np.nan_to_num(test_df[remaining].values, nan=0.0)

        m = XGBRegressor(**XGB_PARAMS)
        m.fit(X_train, y_train, verbose=False)
        preds = m.predict(X_test)
        ic, _ = spearmanr(preds, y_test)
        ic = float(ic) if not np.isnan(ic) else 0.0

        short_id = FACTOR_SHORT_IDS[drop_col]
        ic_drop = full_ic - ic  # Positive = factor was helpful
        ablation["factors"][short_id] = {
            "ic_without": round(ic, 4),
            "ic_drop": round(ic_drop, 4),
            "importance": "critical" if ic_drop > 0.02 else "useful" if ic_drop > 0 else "redundant",
        }
        print(f"  {short_id}: IC without={ic:.4f}, drop={ic_drop:+.4f} → {ablation['factors'][short_id]['importance']}")

    return ablation


def run_diagnostics(features_df: pd.DataFrame) -> dict:
    """Run all IC diagnostics and save results."""
    print("=" * 60)
    print("[ic_diag] USD Monitor IC Diagnostics")
    print("=" * 60)

    result = {
        "multi_target_ic": multi_target_ic_matrix(features_df),
        "multi_window_ic": multi_window_ic(features_df),
        "ablation": leave_one_out_ablation(features_df),
    }

    _save_json(result, "ic_diagnostic.json")
    print("\n[ic_diag] Diagnostics complete.")
    return result


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    result = run_diagnostics(features)
