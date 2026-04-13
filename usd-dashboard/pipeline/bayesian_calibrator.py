"""
USD Monitor P1 — Constrained Bayesian Calibrator

Adjusts γ component weights based on historical ML performance feedback.
Constraints:
  - ±10% max_shift per component from base weights
  - Quarterly update schedule (not continuous)
  - Frozen during regime breaks (multiplier < 0.5)

Architecture:
  Base weights:  w_rf=0.35, w_pi=0.25, w_cy=0.25, w_sigma=dynamic
  Bayesian:      posterior = prior × likelihood(ML IC per γ component)
  Constrained:   |w_new - w_base| ≤ 0.10 per component
  Output:        calibration.json → used by signal_router + scoring

References:
  - Roundtable P1: ±10% max_shift, quarterly, frozen during regime breaks
  - López de Prado: walk-forward weight stability
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
from scipy import stats

from config_v2 import OUTPUT_DIR, FACTOR_COLS, FACTOR_DISPLAY


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
# Base Weights (matching scoring.py:260)
# ══════════════════════════════════════════════════════════════════════════

BASE_WEIGHTS = {
    "rf":      0.35,
    "pi_risk": 0.25,
    "cy":      0.25,   # Note: cy is subtracted in γ formula
    "sigma":   0.15,   # Dynamic in practice (0.10-0.20), 0.15 center
}

MAX_SHIFT = 0.10  # ±10% absolute shift per component
CALIBRATION_LOOKBACK_DAYS = 252  # 1 year of data
MIN_OBSERVATIONS = 60  # Minimum days to calibrate


# ══════════════════════════════════════════════════════════════════════════
# γ Component → ML Factor Mapping
# ══════════════════════════════════════════════════════════════════════════

# Which ML factors most closely correspond to each γ component?
# Used to compute per-component likelihood from SHAP/IC data.
COMPONENT_FACTOR_MAP = {
    "rf":      ["F1_RateDiff", "F2_RealRateDelta", "F6_YCMomentum"],
    "pi_risk": ["F4_VIX", "F8_CreditResidual", "F9_VolSpread"],
    "cy":      ["F10_FundingStress", "F5_BEI"],
    "sigma":   ["F4_VIX", "F9_VolSpread", "F3_TermSpread"],
}


def _compute_component_ic(
    features_df: pd.DataFrame,
    target_col: str = "target",
    lookback: int = CALIBRATION_LOOKBACK_DAYS,
) -> dict:
    """
    Compute rolling Spearman IC for each γ component's related ML factors.
    Returns average IC per component over the lookback window.
    """
    if target_col not in features_df.columns:
        return {k: 0.0 for k in BASE_WEIGHTS}

    df = features_df.dropna(subset=[target_col]).tail(lookback)
    if len(df) < MIN_OBSERVATIONS:
        return {k: 0.0 for k in BASE_WEIGHTS}

    target = df[target_col].values
    component_ics = {}

    for comp, factors in COMPONENT_FACTOR_MAP.items():
        ics = []
        for f in factors:
            if f in df.columns:
                vals = df[f].values
                mask = ~(np.isnan(vals) | np.isnan(target))
                if mask.sum() > 30:
                    ic, _ = stats.spearmanr(vals[mask], target[mask])
                    if not np.isnan(ic):
                        ics.append(abs(ic))  # Absolute IC = predictive power
        component_ics[comp] = float(np.mean(ics)) if ics else 0.0

    return component_ics


def _bayesian_update(
    base_weights: dict,
    component_ics: dict,
    max_shift: float = MAX_SHIFT,
) -> dict:
    """
    Bayesian-inspired weight update:
      posterior_weight ∝ prior_weight × likelihood(IC)

    Likelihood = softmax(IC) — components with higher IC get more weight.
    Constrained: |w_new - w_base| ≤ max_shift per component.
    Final: renormalized so sum ≈ 1.0 (for the non-sigma components).

    This is a constrained Bayesian approach:
      - Prior = base weights (encoding domain knowledge)
      - Likelihood = IC performance (empirical evidence)
      - Constraint = ±10% shift (preventing overfit to recent data)
    """
    components = list(base_weights.keys())

    # Compute softmax over ICs as likelihood
    ics = np.array([component_ics.get(c, 0.0) for c in components])
    ics = np.clip(ics, 0, 1)  # Ensure non-negative

    # Temperature-scaled softmax (τ=0.5 for moderate sensitivity)
    tau = 0.5
    if ics.sum() > 0:
        exp_ics = np.exp(ics / tau)
        likelihood = exp_ics / exp_ics.sum()
    else:
        likelihood = np.ones(len(components)) / len(components)

    # Prior = base weights (normalized)
    prior = np.array([base_weights[c] for c in components])
    prior = prior / prior.sum()

    # Posterior ∝ prior × likelihood
    posterior = prior * likelihood
    posterior = posterior / posterior.sum()

    # Scale back to original total weight
    total_base = sum(base_weights.values())
    posterior_weights = {}
    for i, comp in enumerate(components):
        raw_new = posterior[i] * total_base
        # Apply ±max_shift constraint
        clamped = np.clip(raw_new, base_weights[comp] - max_shift, base_weights[comp] + max_shift)
        posterior_weights[comp] = round(float(clamped), 4)

    return posterior_weights


def _should_calibrate(
    regime_multiplier: float,
    last_calibration_date=None,
    force: bool = False,
) -> tuple:
    """
    Quarterly calibration schedule with regime freeze.

    Returns:
        (should_calibrate, reason)
    """
    if force:
        return True, "forced"

    # Freeze during regime breaks
    if regime_multiplier < 0.5:
        return False, f"regime_frozen (mult={regime_multiplier:.2f})"

    if last_calibration_date is None:
        return True, "first_calibration"

    try:
        last_dt = datetime.strptime(last_calibration_date, "%Y-%m-%d")
        days_since = (datetime.now() - last_dt).days
        if days_since >= 90:  # Quarterly = ~90 days
            return True, f"quarterly ({days_since}d since last)"
        return False, f"too_recent ({days_since}d < 90d)"
    except Exception:
        return True, "invalid_last_date"


def calibrate_weights(
    features_df: pd.DataFrame,
    regime_multiplier: float = 1.0,
    force: bool = False,
) -> dict:
    """
    Main calibration entry point.

    Args:
        features_df: DataFrame with FACTOR_COLS + 'target' column
        regime_multiplier: Current regime multiplier (freeze if < 0.5)
        force: Force recalibration regardless of schedule

    Returns:
        Calibration result dict → saved as calibration.json
    """
    print("=" * 60)
    print("[calibrator] Constrained Bayesian Calibration")
    print("=" * 60)

    # Check if we should calibrate
    existing = _load_existing_calibration()
    last_date = existing.get("calibration_date") if existing else None
    should_cal, reason = _should_calibrate(regime_multiplier, last_date, force)

    if not should_cal:
        print(f"  Skipping calibration: {reason}")
        if existing:
            print(f"  Using existing weights: {existing.get('calibrated_weights', BASE_WEIGHTS)}")
            return existing
        # Return base weights if no existing calibration
        return _build_calibration_result(BASE_WEIGHTS, {}, "no_calibration", reason)

    print(f"  Calibrating: {reason}")

    # Compute per-component IC
    component_ics = _compute_component_ic(features_df)
    print(f"  Component ICs: {' | '.join(f'{k}={v:.3f}' for k, v in component_ics.items())}")

    # Bayesian update with constraints
    new_weights = _bayesian_update(BASE_WEIGHTS, component_ics)

    # Compute shifts from base
    shifts = {k: round(new_weights[k] - BASE_WEIGHTS[k], 4) for k in BASE_WEIGHTS}
    print(f"  Base weights:       {' | '.join(f'{k}={v:.2f}' for k, v in BASE_WEIGHTS.items())}")
    print(f"  Calibrated weights: {' | '.join(f'{k}={v:.2f}' for k, v in new_weights.items())}")
    print(f"  Shifts:             {' | '.join(f'{k}={v:+.3f}' for k, v in shifts.items())}")

    result = _build_calibration_result(new_weights, component_ics, "calibrated", reason, shifts)
    _save_json(result, "calibration.json")
    return result


def _build_calibration_result(
    weights: dict,
    component_ics: dict,
    status: str,
    reason: str,
    shifts=None,
) -> dict:
    return {
        "calibration_date": datetime.now().strftime("%Y-%m-%d"),
        "status": status,
        "reason": reason,
        "base_weights": BASE_WEIGHTS,
        "calibrated_weights": weights,
        "shifts": shifts or {k: 0.0 for k in BASE_WEIGHTS},
        "component_ics": component_ics,
        "max_shift_constraint": MAX_SHIFT,
        "schedule": "quarterly",
    }


def _load_existing_calibration():
    path = OUTPUT_DIR / "calibration.json"
    try:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    except Exception:
        pass
    return None


def get_calibrated_weights() -> dict:
    """
    Read calibrated weights from output file.
    Falls back to base weights if no calibration exists.
    """
    cal = _load_existing_calibration()
    if cal and "calibrated_weights" in cal:
        return cal["calibrated_weights"]
    return BASE_WEIGHTS.copy()


if __name__ == "__main__":
    # Demo with synthetic data
    print("=== Bayesian Calibrator Demo ===\n")

    # Create synthetic features
    np.random.seed(42)
    n = 300
    dates = pd.date_range("2025-01-01", periods=n, freq="B")
    df = pd.DataFrame(index=dates)
    for col in FACTOR_COLS:
        df[col] = np.random.randn(n)
    # Synthetic target correlated with F1, F2 (rf-related factors)
    df["target"] = 0.5 * df["F1_RateDiff"] + 0.3 * df["F2_RealRateDelta"] + 0.2 * np.random.randn(n)

    result = calibrate_weights(df, regime_multiplier=1.0, force=True)
    print(f"\n  Status: {result['status']}")
    print(f"  Calibrated: {result['calibrated_weights']}")
    print(f"  Shifts: {result['shifts']}")
