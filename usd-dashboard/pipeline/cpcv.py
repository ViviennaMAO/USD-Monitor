"""
USD Monitor Phase 2 — Combinatorial Purged Cross-Validation (CPCV)
Validates that the strategy has real alpha, not just lucky on one data split.
Marcos López de Prado methodology: C(N, K) train-test combinations.
"""
import itertools
import numpy as np
import pandas as pd
from scipy import stats
from xgboost import XGBRegressor
from scipy.stats import spearmanr

from config_v2 import (
    CPCV_N_BLOCKS, CPCV_N_TEST, XGB_PARAMS, FACTOR_COLS,
    FORWARD_DAYS, TRAIN_END, OUTPUT_DIR,
)


def run_cpcv_validation(features_df: pd.DataFrame) -> dict:
    """
    Run CPCV validation on training data.
    Splits into N_BLOCKS, generates C(N,K) train-test combinations,
    trains independent models, computes Sharpe and IC for each path.
    """
    # Use only training period data with valid targets
    train_mask = features_df.index <= pd.Timestamp(TRAIN_END)
    df = features_df[train_mask].dropna(subset=["target"])

    X = df[FACTOR_COLS].values
    y = df["target"].values
    n = len(df)

    # Split into blocks
    block_size = n // CPCV_N_BLOCKS
    blocks = []
    for i in range(CPCV_N_BLOCKS):
        start = i * block_size
        end = start + block_size if i < CPCV_N_BLOCKS - 1 else n
        blocks.append(np.arange(start, end))

    # Generate all C(N, K) test combinations
    combos = list(itertools.combinations(range(CPCV_N_BLOCKS), CPCV_N_TEST))
    print(f"[cpcv] {len(combos)} paths from C({CPCV_N_BLOCKS},{CPCV_N_TEST})")

    path_results = []
    for path_idx, test_blocks in enumerate(combos):
        # Test indices
        test_idx = np.concatenate([blocks[b] for b in test_blocks])
        # Train indices (all other blocks, with purge gap)
        train_blocks = [b for b in range(CPCV_N_BLOCKS) if b not in test_blocks]
        train_idx = np.concatenate([blocks[b] for b in train_blocks])

        # Purge: remove train samples within FORWARD_DAYS of test boundaries
        test_set = set(test_idx)
        purged_train = []
        for idx in train_idx:
            too_close = any(abs(idx - t) < FORWARD_DAYS for t in [test_idx.min(), test_idx.max()])
            if not too_close:
                purged_train.append(idx)
        purged_train = np.array(purged_train)

        if len(purged_train) < 100 or len(test_idx) < 50:
            continue

        X_train, y_train = X[purged_train], y[purged_train]
        X_test, y_test = X[test_idx], y[test_idx]

        # Train
        model = XGBRegressor(**XGB_PARAMS)
        model.fit(X_train, y_train, verbose=False)
        preds = model.predict(X_test)

        # IC
        ic, _ = spearmanr(preds, y_test)

        # Approximate Sharpe from predictions × actuals
        daily_pnl = preds * y_test  # Directional PnL proxy
        sharpe = (daily_pnl.mean() / daily_pnl.std() * np.sqrt(252)
                  if daily_pnl.std() > 0 else 0.0)

        path_results.append({
            "path": path_idx,
            "test_blocks": list(test_blocks),
            "ic": round(float(ic), 4) if not np.isnan(ic) else 0.0,
            "sharpe": round(float(sharpe), 4),
            "n_train": len(purged_train),
            "n_test": len(test_idx),
        })

    if not path_results:
        print("[cpcv] No valid paths generated")
        return {"valid": False}

    # Aggregate statistics
    sharpes = [p["sharpe"] for p in path_results]
    ics = [p["ic"] for p in path_results]

    median_sharpe = float(np.median(sharpes))
    positive_pct = sum(1 for s in sharpes if s > 0) / len(sharpes)

    # t-test: H0 = median Sharpe == 0
    t_stat, p_value = stats.ttest_1samp(sharpes, 0.0)

    result = {
        "valid": True,
        "n_paths": len(path_results),
        "median_sharpe": round(median_sharpe, 4),
        "mean_sharpe": round(float(np.mean(sharpes)), 4),
        "best_sharpe": round(float(max(sharpes)), 4),
        "worst_sharpe": round(float(min(sharpes)), 4),
        "positive_paths_pct": round(positive_pct * 100, 1),
        "t_stat": round(float(t_stat), 4),
        "p_value": round(float(p_value), 6),
        "median_ic": round(float(np.median(ics)), 4),
        "paths": path_results,
    }

    print(f"[cpcv] Results:")
    print(f"  Median Sharpe: {result['median_sharpe']}")
    print(f"  Positive paths: {result['positive_paths_pct']}%")
    print(f"  p-value: {result['p_value']}")
    print(f"  Best/Worst: {result['best_sharpe']} / {result['worst_sharpe']}")

    return result


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    result = run_cpcv_validation(features)
    print(f"\nCPCV Alpha {'CONFIRMED' if result.get('p_value', 1) < 0.05 else 'NOT CONFIRMED'}")
