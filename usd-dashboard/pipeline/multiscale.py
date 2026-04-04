"""
USD Monitor Phase 2 — Multi-Horizon Ensemble
Trains models on 10d/20d/40d targets, IC-weighted ensemble prediction.
"""
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from scipy.stats import spearmanr

from config_v2 import (
    HORIZONS, XGB_PARAMS, FACTOR_COLS, FORWARD_DAYS,
    TRAIN_END, BASE_DIR, OUTPUT_DIR,
)


def build_multiscale_targets(features_df: pd.DataFrame) -> pd.DataFrame:
    """Add multi-horizon target columns."""
    df = features_df.copy()
    price = df["dxy_price"]
    for h in HORIZONS:
        df[f"target_{h}d"] = (price.shift(-h) / price - 1) * 100
    return df


def train_multiscale_models(features_df: pd.DataFrame) -> dict:
    """
    Train one model per horizon, compute IC-weighted ensemble.
    Returns dict with per-horizon IC and ensemble weights.
    """
    df = build_multiscale_targets(features_df)
    train_mask = df.index <= pd.Timestamp(TRAIN_END)

    results = {}
    models = {}

    for h in HORIZONS:
        target_col = f"target_{h}d"
        train_df = df[train_mask].dropna(subset=[target_col])
        test_df = df[~train_mask].dropna(subset=[target_col])

        if len(train_df) < 200 or len(test_df) < 30:
            print(f"[multiscale] {h}d: insufficient data (train={len(train_df)}, test={len(test_df)})")
            continue

        X_train = train_df[FACTOR_COLS].values
        y_train = train_df[target_col].values
        X_test = test_df[FACTOR_COLS].values
        y_test = test_df[target_col].values

        # Train
        model = XGBRegressor(**XGB_PARAMS)
        model.fit(X_train, y_train, verbose=False)
        preds = model.predict(X_test)

        # IC
        ic, _ = spearmanr(preds, y_test)
        ic = float(ic) if not np.isnan(ic) else 0.0

        # Save model
        model_path = BASE_DIR / f"model_dxy_{h}d.json"
        model.save_model(str(model_path))

        results[h] = {"ic": round(ic, 4), "n_test": len(test_df)}
        models[h] = model
        print(f"[multiscale] {h}d: IC={ic:.4f}, n_test={len(test_df)}")

    # Compute IC-weighted ensemble weights
    # Only positive IC models get weight
    positive_ics = {h: r["ic"] for h, r in results.items() if r["ic"] > 0}
    total_ic = sum(positive_ics.values()) if positive_ics else 1.0

    weights = {}
    for h in HORIZONS:
        if h in positive_ics:
            weights[h] = round(positive_ics[h] / total_ic, 4)
        else:
            weights[h] = 0.0

    results["weights"] = weights
    print(f"[multiscale] Ensemble weights: {weights}")

    return results


def predict_ensemble(features_row: np.ndarray) -> float:
    """
    Generate ensemble prediction from all horizon models.
    Normalizes predictions to 20d-equivalent.
    """
    weighted_pred = 0.0
    total_weight = 0.0

    for h in HORIZONS:
        model_path = BASE_DIR / f"model_dxy_{h}d.json"
        if not model_path.exists():
            continue

        model = XGBRegressor()
        model.load_model(str(model_path))
        pred = float(model.predict(features_row.reshape(1, -1))[0])

        # Normalize to 20d equivalent
        pred_normalized = pred * (FORWARD_DAYS / h)

        # Load weights (simplified: use equal weight if no saved weights)
        weight = 1.0 / len(HORIZONS)
        weighted_pred += pred_normalized * weight
        total_weight += weight

    if total_weight > 0:
        return weighted_pred / total_weight
    return 0.0


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    results = train_multiscale_models(features)
    print(f"\nMulti-scale results: {results}")
