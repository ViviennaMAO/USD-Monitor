"""
USD Monitor P1 — Signal-Level OLS Orthogonalization

Removes the component of ML prediction that's already captured by γ,
ensuring the two signals provide genuinely independent information.

Formula:
    ml_ortho = ml_pred - β × γ_normalized

Where β is estimated via rolling OLS:
    ml_pred_i = α + β × γ_norm_i + ε_i

The residual ε (= ml_ortho) is the "new information" from ML
that γ doesn't already know.

Benefits:
  - Eliminates double-counting in the 3×3 credibility matrix
  - Makes conflict score more meaningful (conflict = true disagreement)
  - Stabilizes signal router during correlated factor moves

References:
  - López de Prado: "signal-level orthogonalization before blending"
  - Roundtable P1: OLS orthogonalization, ml_ortho = ml_pred - β × γ_score
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

from config_v2 import OUTPUT_DIR


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
# OLS Estimation
# ══════════════════════════════════════════════════════════════════════════

OLS_LOOKBACK = 120  # ~6 months of trading days
OLS_MIN_OBS = 40    # Minimum observations for OLS


def _ols_beta(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float]:
    """
    Simple OLS: y = α + β × x + ε

    Returns: (alpha, beta, r_squared)
    """
    mask = ~(np.isnan(x) | np.isnan(y))
    x_clean, y_clean = x[mask], y[mask]
    n = len(x_clean)

    if n < OLS_MIN_OBS:
        return 0.0, 0.0, 0.0

    x_mean = x_clean.mean()
    y_mean = y_clean.mean()

    x_centered = x_clean - x_mean
    y_centered = y_clean - y_mean

    ss_xx = (x_centered ** 2).sum()
    ss_xy = (x_centered * y_centered).sum()

    if ss_xx < 1e-10:
        return y_mean, 0.0, 0.0

    beta = ss_xy / ss_xx
    alpha = y_mean - beta * x_mean

    y_hat = alpha + beta * x_clean
    ss_res = ((y_clean - y_hat) ** 2).sum()
    ss_tot = ((y_clean - y_mean) ** 2).sum()
    r_sq = 1.0 - (ss_res / ss_tot) if ss_tot > 1e-10 else 0.0

    return float(alpha), float(beta), float(r_sq)


def _normalize_gamma(gamma_score: float) -> float:
    """Normalize γ (0-100) to [-1, 1] centered at 50."""
    return (gamma_score - 50.0) / 50.0


def _normalize_ml(ml_pred: float) -> float:
    """Normalize ML prediction to [-1, 1], clipped at ±2%."""
    return max(-1.0, min(1.0, ml_pred / 2.0))


# ══════════════════════════════════════════════════════════════════════════
# Orthogonalization
# ══════════════════════════════════════════════════════════════════════════

def estimate_ols_relationship(
    gamma_history: list,
    ml_history: list,
    lookback: int = OLS_LOOKBACK,
) -> dict:
    """
    Estimate the OLS relationship between γ and ML over a rolling window.

    Args:
        gamma_history: List of historical γ scores (0-100)
        ml_history: List of historical ML predictions (%)

    Returns:
        OLS parameters: alpha, beta, r_squared, n_obs
    """
    # Use most recent lookback observations
    g = np.array(gamma_history[-lookback:])
    m = np.array(ml_history[-lookback:])

    # Normalize
    g_norm = (g - 50.0) / 50.0
    m_norm = np.clip(m / 2.0, -1.0, 1.0)

    alpha, beta, r_sq = _ols_beta(g_norm, m_norm)

    return {
        "alpha": round(alpha, 6),
        "beta": round(beta, 6),
        "r_squared": round(r_sq, 6),
        "n_obs": int(min(len(g), len(m), lookback)),
    }


def orthogonalize_ml(
    ml_pred: float,
    gamma_score: float,
    ols_params: dict,
) -> dict:
    """
    Compute orthogonalized ML prediction:
        ml_ortho = ml_pred_norm - β × γ_norm

    The orthogonal residual represents the ML's unique information
    that is NOT already captured by γ.

    Args:
        ml_pred: Raw ML prediction (20d return %)
        gamma_score: Current γ score (0-100)
        ols_params: Dict with alpha, beta from OLS estimation

    Returns:
        Dict with ml_raw, ml_ortho, beta, explained_pct, etc.
    """
    g_norm = _normalize_gamma(gamma_score)
    m_norm = _normalize_ml(ml_pred)

    alpha = ols_params.get("alpha", 0.0)
    beta = ols_params.get("beta", 0.0)

    # Expected ML given γ
    m_expected = alpha + beta * g_norm

    # Orthogonal residual = actual ML - expected from γ
    ml_ortho_norm = m_norm - m_expected

    # Convert back to % scale
    ml_ortho_pct = ml_ortho_norm * 2.0

    # How much of ML is explained by γ?
    r_sq = ols_params.get("r_squared", 0.0)
    explained_pct = round(r_sq * 100, 1)

    return {
        "ml_raw": round(ml_pred, 4),
        "ml_raw_norm": round(m_norm, 4),
        "ml_ortho_norm": round(ml_ortho_norm, 4),
        "ml_ortho_pct": round(ml_ortho_pct, 4),
        "gamma_norm": round(g_norm, 4),
        "gamma_expected_ml": round(m_expected, 4),
        "beta": round(beta, 4),
        "alpha": round(alpha, 4),
        "r_squared": round(r_sq, 4),
        "explained_by_gamma_pct": explained_pct,
        "independent_info_pct": round(100 - explained_pct, 1),
    }


# ══════════════════════════════════════════════════════════════════════════
# Pipeline Integration
# ══════════════════════════════════════════════════════════════════════════

def run_orthogonalization(
    ml_pred: float,
    gamma_score: float,
    gamma_history=None,
    ml_history=None,
) -> dict:
    """
    Full orthogonalization pipeline.

    If history is provided, estimates OLS in-sample.
    If not, loads existing OLS params from output file.

    Returns:
        orthogonalization result → saved as orthogonalization.json
    """
    print("=" * 60)
    print("[orthogonalizer] Signal-Level OLS Orthogonalization")
    print("=" * 60)

    # Estimate OLS if history provided
    if gamma_history and ml_history and len(gamma_history) >= OLS_MIN_OBS:
        ols_params = estimate_ols_relationship(gamma_history, ml_history)
        print(f"  OLS estimated: α={ols_params['alpha']:.4f}, "
              f"β={ols_params['beta']:.4f}, "
              f"R²={ols_params['r_squared']:.4f}, "
              f"n={ols_params['n_obs']}")
    else:
        # Try loading existing params
        ols_params = _load_existing_ols()
        if ols_params:
            print(f"  Using existing OLS: β={ols_params['beta']:.4f}, R²={ols_params['r_squared']:.4f}")
        else:
            print("  No history available, using zero β (no orthogonalization)")
            ols_params = {"alpha": 0.0, "beta": 0.0, "r_squared": 0.0, "n_obs": 0}

    # Orthogonalize
    result = orthogonalize_ml(ml_pred, gamma_score, ols_params)

    print(f"  ML raw:   {result['ml_raw']:+.4f}% (norm: {result['ml_raw_norm']:+.4f})")
    print(f"  ML ortho: {result['ml_ortho_pct']:+.4f}% (norm: {result['ml_ortho_norm']:+.4f})")
    print(f"  γ explains {result['explained_by_gamma_pct']:.1f}% of ML")
    print(f"  Independent info: {result['independent_info_pct']:.1f}%")

    # Save
    output = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "ols_params": ols_params,
        "orthogonalization": result,
    }
    _save_json(output, "orthogonalization.json")

    return output


def _load_existing_ols():
    path = OUTPUT_DIR / "orthogonalization.json"
    try:
        if path.exists():
            with open(path) as f:
                data = json.load(f)
            return data.get("ols_params")
    except Exception:
        pass
    return None


def get_orthogonalized_ml(ml_pred: float, gamma_score: float) -> float:
    """
    Quick access: returns orthogonalized ML prediction in %.
    Loads existing OLS params. If none, returns raw ml_pred.
    """
    ols_params = _load_existing_ols()
    if not ols_params or ols_params.get("beta", 0) == 0:
        return ml_pred

    result = orthogonalize_ml(ml_pred, gamma_score, ols_params)
    return result["ml_ortho_pct"]


if __name__ == "__main__":
    # Demo
    print("=== Orthogonalizer Demo ===\n")

    # Simulate: γ and ML are partially correlated
    np.random.seed(42)
    n = 200
    gamma_hist = 50 + 15 * np.random.randn(n)
    gamma_hist = np.clip(gamma_hist, 0, 100).tolist()

    # ML = 0.3 × γ_norm + noise (30% overlap)
    ml_hist = [0.3 * ((g - 50) / 50) * 2 + np.random.randn() * 0.5 for g in gamma_hist]

    result = run_orthogonalization(
        ml_pred=1.2,
        gamma_score=75,
        gamma_history=gamma_hist,
        ml_history=ml_hist,
    )

    print(f"\n  Demo: γ=75, ML=+1.2%")
    print(f"  Ortho ML: {result['orthogonalization']['ml_ortho_pct']:+.4f}%")
    print(f"  β={result['ols_params']['beta']:.4f}, R²={result['ols_params']['r_squared']:.4f}")
