"""
USD Monitor — Unified Signal Router (P0 + v2 IC-Adaptive)

Resolves the dual-engine conflict between:
  - TypeScript γ scoring engine (rule-based, 0-100)
  - Python ML engine (XGBoost, 20d return prediction)

Architecture:
  1. Compute conflict score between γ and ML signals
  2. Route through regime-aware decision matrix
  3. **v2**: IC-adaptive routing — when ML is healthy (IC > 0.10),
     ML gets dominant weight; when degraded, γ leads
  4. Generate SHAP conflict diagnosis when signals diverge
  5. Output unified_signal.json for Dashboard + Backtest

v2 Changes (2026-04-16):
  - IC-adaptive credibility: ML-dominant when IC > 0.10, balanced when 0-0.10, γ-dominant when IC < 0
  - Conflict option direction follows ML (not γ) when ML IC > 0.10
  - γ=neutral + ML signal → size 75% (was 50%) when ML healthy
  - Added model_health parameter to route_signal()

References: Roundtable discussion 2026-04-08
  - Dalio: 3×3 credibility matrix
  - Soros: conflict_score as regime transition leading indicator
  - Taleb: conflict option (0.25 size + wide stop) instead of FLAT
  - Simons: SHAP conflict attribution
  - López de Prado: dual-layer router + signal-level orthogonalization
"""
import json
import numpy as np
from pathlib import Path

from config_v2 import (
    FACTOR_COLS, FACTOR_DISPLAY, FACTOR_SHORT_IDS,
    SIGNAL_THRESHOLDS, OUTPUT_DIR,
    ATR_STOP_MULT,
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


# ══════════════════════════════════════════════════════════════════════════
# Signal Normalization
# ══════════════════════════════════════════════════════════════════════════

def _gamma_direction(gamma_score: float) -> str:
    """Map γ 0-100 to direction."""
    if gamma_score >= 65:
        return "bull"
    elif gamma_score < 35:
        return "bear"
    return "neutral"


def _ml_direction(ml_pred: float) -> str:
    """Map ML prediction (20d return %) to direction."""
    if ml_pred >= SIGNAL_THRESHOLDS["buy"]:       # 0.4%
        return "buy"
    elif ml_pred <= SIGNAL_THRESHOLDS["sell"]:     # -0.4%
        return "sell"
    return "neutral"


def _normalize_gamma(gamma_score: float) -> float:
    """Normalize γ (0-100) to [-1, 1] centered at 50."""
    return (gamma_score - 50) / 50


def _normalize_ml(ml_pred: float) -> float:
    """Normalize ML prediction to [-1, 1], clipped at ±2%."""
    return max(-1.0, min(1.0, ml_pred / 2.0))


# ══════════════════════════════════════════════════════════════════════════
# Conflict Score
# ══════════════════════════════════════════════════════════════════════════

def compute_conflict_score(gamma_score: float, ml_pred: float) -> float:
    """
    Conflict score ∈ [0, 1].
    0 = perfect agreement, 1 = maximum contradiction.

    Soros insight: conflict_score > 0.6 is a leading indicator of regime transition.
    """
    g_norm = _normalize_gamma(gamma_score)
    m_norm = _normalize_ml(ml_pred)
    return round(abs(g_norm - m_norm) / 2, 4)  # /2 to scale to [0,1]


# ══════════════════════════════════════════════════════════════════════════
# Regime Router
# ══════════════════════════════════════════════════════════════════════════

def determine_regime_state(
    regime_result: dict,
    conflict_score: float,
    vix_z: float = 0.0,
) -> str:
    """
    Regime state routing (Soros + Dalio):
      'crisis'       — VIX extreme or regime multiplier very low
      'policy_shock' — External policy event detected
      'transition'   — Conflict score > 0.6 (leading indicator)
      'normal'       — Standard operation
    """
    multiplier = regime_result.get("multiplier", 1.0)

    # L1: Liquidity crisis — Circuit Breaker territory
    if vix_z > 3.0 or multiplier <= 0.3:
        return "crisis"

    # L2: Conflict-driven transition (Soros insight)
    # High conflict = regime is shifting, neither engine reliable alone
    if conflict_score > 0.6:
        return "transition"

    # L3: Extreme regime compression
    if multiplier <= 0.65:
        return "policy_shock"

    return "normal"


# ══════════════════════════════════════════════════════════════════════════
# IC-Adaptive Model Health Thresholds
# ══════════════════════════════════════════════════════════════════════════

ML_DOMINANT_IC = 0.10       # Above this: ML leads routing decisions
ML_BALANCED_IC = 0.00       # Above this: equal weight γ/ML
                            # Below 0: γ leads (ML degraded)


# ══════════════════════════════════════════════════════════════════════════
# 3×3 Credibility Matrices (Dalio) — IC-Adaptive
# ══════════════════════════════════════════════════════════════════════════

# BASELINE matrix: (gamma_direction, ml_direction) → {action, size_mult, stop_mult}
# Used when IC is between 0 and ML_DOMINANT_IC (balanced mode)
CREDIBILITY_MATRIX = {
    # Full consensus — maximum conviction
    ("bull",    "buy"):     {"action": "LONG",  "size_mult": 1.00, "stop_mult": 1.0},
    ("bear",    "sell"):    {"action": "SHORT", "size_mult": 1.00, "stop_mult": 1.0},

    # Partial consensus — half conviction
    ("bull",    "neutral"): {"action": "LONG",  "size_mult": 0.50, "stop_mult": 1.0},
    ("neutral", "buy"):     {"action": "LONG",  "size_mult": 0.50, "stop_mult": 1.0},
    ("bear",    "neutral"): {"action": "SHORT", "size_mult": 0.50, "stop_mult": 1.0},
    ("neutral", "sell"):    {"action": "SHORT", "size_mult": 0.50, "stop_mult": 1.0},

    # No signal
    ("neutral", "neutral"): {"action": "FLAT",  "size_mult": 0.00, "stop_mult": 1.0},

    # Contradiction — Taleb's "conflict option"
    ("bull",    "sell"):    {"action": "CONFLICT_OPTION", "size_mult": 0.25, "stop_mult": 1.5},
    ("bear",    "buy"):     {"action": "CONFLICT_OPTION", "size_mult": 0.25, "stop_mult": 1.5},
}

# ML-DOMINANT matrix: when IC > ML_DOMINANT_IC
# Key diffs: ML direction gets priority, sizes boosted when ML has signal
CREDIBILITY_MATRIX_ML_DOM = {
    # Full consensus — max conviction (same)
    ("bull",    "buy"):     {"action": "LONG",  "size_mult": 1.00, "stop_mult": 1.0},
    ("bear",    "sell"):    {"action": "SHORT", "size_mult": 1.00, "stop_mult": 1.0},

    # γ agrees, ML neutral → smaller position (γ alone not enough)
    ("bull",    "neutral"): {"action": "LONG",  "size_mult": 0.30, "stop_mult": 1.0},
    ("bear",    "neutral"): {"action": "SHORT", "size_mult": 0.30, "stop_mult": 1.0},

    # ML has signal, γ neutral → ML leads, boosted size (was 0.50)
    ("neutral", "buy"):     {"action": "LONG",  "size_mult": 0.75, "stop_mult": 1.0},
    ("neutral", "sell"):    {"action": "SHORT", "size_mult": 0.75, "stop_mult": 1.0},

    # No signal
    ("neutral", "neutral"): {"action": "FLAT",  "size_mult": 0.00, "stop_mult": 1.0},

    # Contradiction — follow ML direction (not γ) when ML is healthy
    ("bull",    "sell"):    {"action": "ML_OVERRIDE", "size_mult": 0.40, "stop_mult": 1.3},
    ("bear",    "buy"):     {"action": "ML_OVERRIDE", "size_mult": 0.40, "stop_mult": 1.3},
}

# γ-DOMINANT matrix: when IC < 0 (ML degraded)
CREDIBILITY_MATRIX_GAMMA_DOM = {
    # Full consensus — still trust
    ("bull",    "buy"):     {"action": "LONG",  "size_mult": 0.80, "stop_mult": 1.0},
    ("bear",    "sell"):    {"action": "SHORT", "size_mult": 0.80, "stop_mult": 1.0},

    # γ has signal, ML anything → follow γ at reduced size
    ("bull",    "neutral"): {"action": "LONG",  "size_mult": 0.50, "stop_mult": 1.2},
    ("bear",    "neutral"): {"action": "SHORT", "size_mult": 0.50, "stop_mult": 1.2},

    # ML has signal, γ neutral → distrust ML when IC < 0
    ("neutral", "buy"):     {"action": "FLAT",  "size_mult": 0.00, "stop_mult": 1.0},
    ("neutral", "sell"):    {"action": "FLAT",  "size_mult": 0.00, "stop_mult": 1.0},

    # No signal
    ("neutral", "neutral"): {"action": "FLAT",  "size_mult": 0.00, "stop_mult": 1.0},

    # Contradiction — follow γ (ML is wrong), but small size
    ("bull",    "sell"):    {"action": "LONG",  "size_mult": 0.25, "stop_mult": 1.5},
    ("bear",    "buy"):     {"action": "SHORT", "size_mult": 0.25, "stop_mult": 1.5},
}


def _select_matrix(rolling_ic: float) -> tuple:
    """Select credibility matrix based on rolling IC."""
    if rolling_ic >= ML_DOMINANT_IC:
        return CREDIBILITY_MATRIX_ML_DOM, "ml_dominant"
    elif rolling_ic >= ML_BALANCED_IC:
        return CREDIBILITY_MATRIX, "balanced"
    else:
        return CREDIBILITY_MATRIX_GAMMA_DOM, "gamma_dominant"


def route_normal(gamma_score: float, ml_pred: float, rolling_ic: float = 0.10) -> dict:
    """Normal regime: IC-adaptive 3×3 credibility matrix."""
    g_dir = _gamma_direction(gamma_score)
    m_dir = _ml_direction(ml_pred)

    matrix, matrix_mode = _select_matrix(rolling_ic)
    entry = matrix.get((g_dir, m_dir), {"action": "FLAT", "size_mult": 0, "stop_mult": 1.0})

    # Resolve direction
    action = entry["action"]
    if action == "ML_OVERRIDE":
        # ML-dominant: follow ML direction in conflict
        direction = "LONG" if ml_pred > 0 else "SHORT"
    elif action == "CONFLICT_OPTION":
        # Balanced mode: conflict option direction depends on IC
        if rolling_ic >= ML_DOMINANT_IC:
            direction = "LONG" if ml_pred > 0 else "SHORT"
        else:
            direction = "LONG" if gamma_score >= 50 else "SHORT"
    elif action in ("LONG", "SHORT"):
        direction = action
    else:
        direction = "FLAT"

    # Determine source label
    m_dir_as_gamma = m_dir.replace("buy", "bull").replace("sell", "bear")
    if g_dir == m_dir_as_gamma:
        source = "consensus"
    elif action in ("ML_OVERRIDE", "CONFLICT_OPTION"):
        source = "conflict_option"
    elif entry["size_mult"] > 0:
        source = "partial_consensus"
    else:
        source = "no_signal"

    return {
        "action": direction,
        "size_mult": entry["size_mult"],
        "stop_mult": entry["stop_mult"],
        "source": source,
        "matrix_mode": matrix_mode,
        "gamma_dir": g_dir,
        "ml_dir": m_dir,
    }


def route_policy_shock(gamma_score: float) -> dict:
    """Policy shock: γ dictates (Soros — ML has no training data for novel events)."""
    g_dir = _gamma_direction(gamma_score)
    return {
        "action": "LONG" if g_dir == "bull" else "SHORT" if g_dir == "bear" else "FLAT",
        "size_mult": 0.50,   # Half size even in γ-only mode (humility)
        "stop_mult": 1.3,
        "source": "gamma_only",
        "gamma_dir": g_dir,
        "ml_dir": "overridden",
    }


def route_transition(gamma_score: float, ml_pred: float, rolling_ic: float = 0.10) -> dict:
    """
    Transition regime (conflict > 0.6): Taleb's conflict option.
    Tiny position + wide stop = buying optionality on regime resolution.

    v2: Direction follows ML when IC > 0.10 (ML is reliable even during transitions).
    Falls back to γ when ML is degraded.
    """
    g_dir = _gamma_direction(gamma_score)

    # v2: IC-adaptive direction
    if rolling_ic >= ML_DOMINANT_IC:
        direction = "LONG" if ml_pred > 0 else "SHORT"
        source = "conflict_option_ml"
    else:
        direction = "LONG" if gamma_score >= 50 else "SHORT"
        source = "conflict_option_gamma"

    return {
        "action": direction,
        "size_mult": 0.25,
        "stop_mult": 1.5,     # ATR × 5.25 (= 3.5 × 1.5)
        "source": source,
        "gamma_dir": g_dir,
        "ml_dir": _ml_direction(ml_pred),
    }


def route_crisis() -> dict:
    """Crisis: Circuit Breaker takes over — all flat."""
    return {
        "action": "FLAT",
        "size_mult": 0.0,
        "stop_mult": 1.0,
        "source": "circuit_breaker",
        "gamma_dir": "overridden",
        "ml_dir": "overridden",
    }


# ══════════════════════════════════════════════════════════════════════════
# SHAP Conflict Diagnosis (Simons)
# ══════════════════════════════════════════════════════════════════════════

def diagnose_conflict(
    gamma_components: dict,
    shap_values: list,
    conflict_score: float,
) -> dict:
    """
    When γ and ML disagree, explain WHY using SHAP attribution.

    Args:
        gamma_components: {'rf': 72, 'pi_risk': 45, 'cy': 55, 'sigma': 68}
        shap_values: [{'name': '利率差', 'shap_value': +0.3, 'factor_value': 1.2}, ...]
        conflict_score: 0-1

    Returns:
        Diagnosis dict with human-readable explanation.
    """
    if conflict_score < 0.3:
        return {"has_conflict": False, "diagnosis": "信号基本一致，无需诊断"}

    # Find γ's strongest driver
    gamma_driver = max(gamma_components, key=lambda k: gamma_components[k])
    gamma_driver_score = gamma_components[gamma_driver]
    gamma_driver_names = {
        "rf": "利差补偿 (r_f)",
        "pi_risk": "风险溢价 (π_risk)",
        "cy": "便利性收益 (cy)",
        "sigma": "波动率警报 (σ_alert)",
    }
    gamma_driver_name = gamma_driver_names.get(gamma_driver, gamma_driver)

    # Find ML's strongest opposing factor (most negative SHAP if γ is bullish, most positive if bearish)
    if not shap_values:
        return {
            "has_conflict": True,
            "conflict_score": conflict_score,
            "diagnosis": f"γ 受 {gamma_driver_name}({gamma_driver_score}分) 驱动，但 ML 数据不可用",
        }

    # Sort by absolute SHAP value
    sorted_shap = sorted(shap_values, key=lambda x: abs(x.get("shap_value", 0)), reverse=True)

    # γ's direction
    gamma_bullish = gamma_components.get("rf", 50) > 55

    # Find the ML factor pushing against γ's direction
    if gamma_bullish:
        ml_opposing = [s for s in sorted_shap if s.get("shap_value", 0) < -0.01]
    else:
        ml_opposing = [s for s in sorted_shap if s.get("shap_value", 0) > 0.01]

    ml_driver = ml_opposing[0] if ml_opposing else sorted_shap[0]
    ml_driver_name = ml_driver.get("name", "未知因子")
    ml_shap = ml_driver.get("shap_value", 0)

    # Build diagnosis
    gamma_stance = "看多" if gamma_bullish else "看空"
    ml_stance = "看空" if ml_shap < 0 else "看多"

    diagnosis = (
        f"矛盾源：γ 受「{gamma_driver_name}」驱动{gamma_stance}（{gamma_driver_score}分），"
        f"ML 被「{ml_driver_name}」拖向{ml_stance}（SHAP: {ml_shap:+.3f}）。"
    )

    # Add context
    if abs(ml_shap) > 0.5:
        diagnosis += f" {ml_driver_name} 的 SHAP 值极端，可能反映短期冲击。"

    return {
        "has_conflict": True,
        "conflict_score": round(conflict_score, 4),
        "gamma_driver": gamma_driver_name,
        "gamma_driver_score": gamma_driver_score,
        "ml_opposing_factor": ml_driver_name,
        "ml_opposing_shap": round(ml_shap, 4),
        "diagnosis": diagnosis,
        "top_shap_factors": [
            {"name": s.get("name", ""), "shap": round(s.get("shap_value", 0), 4)}
            for s in sorted_shap[:5]
        ],
    }


# ══════════════════════════════════════════════════════════════════════════
# Main Router
# ══════════════════════════════════════════════════════════════════════════

def route_signal(
    gamma_score: float,
    gamma_components: dict,
    ml_pred: float,
    shap_factors: list,
    regime_result: dict,
    vix_z: float = 0.0,
    dxy_price: float = 0.0,
    date: str = "",
    calibration=None,
    orthogonalization=None,
    rolling_ic: float = 0.10,
) -> dict:
    """
    Unified Signal Router — merges γ and ML into a single trading decision.

    Args:
        gamma_score: 0-100 from TypeScript scoring engine
        gamma_components: {'rf': int, 'pi_risk': int, 'cy': int, 'sigma': int}
        ml_pred: float, 20d expected DXY return %
        shap_factors: list of {name, shap_value, factor_value}
        regime_result: dict from regime_usd.detect_regime_v2()
        vix_z: current VIX Z-score
        dxy_price: current DXY price
        date: date string
        calibration: P1 Bayesian calibration result (optional)
        orthogonalization: P1 OLS orthogonalization result (optional)
        rolling_ic: float, 60-day rolling Spearman IC of ML model (v2)

    Returns:
        Unified signal dict → saved as unified_signal.json
    """
    print("=" * 60)
    print("[router] Unified Signal Router (P0 + P1 + v2 IC-Adaptive)")
    print("=" * 60)

    # v2: Determine routing mode from IC
    _, matrix_mode = _select_matrix(rolling_ic)
    print(f"  Rolling IC: {rolling_ic:.3f} → matrix mode: {matrix_mode}")

    # ── P1: Orthogonalization ─────────────────────────────────────────────
    # Use orthogonalized ML if available (removes γ-redundant info)
    ml_for_routing = ml_pred
    ortho_info = None
    if orthogonalization and "orthogonalization" in orthogonalization:
        ortho = orthogonalization["orthogonalization"]
        ml_ortho = ortho.get("ml_ortho_pct", ml_pred)
        beta = ortho.get("beta", 0.0)
        r_sq = ortho.get("r_squared", 0.0)

        # Only use ortho if meaningful β and sufficient R²
        if abs(beta) > 0.05 and r_sq > 0.02:
            ml_for_routing = ml_ortho
            ortho_info = {
                "active": True,
                "ml_raw": round(ml_pred, 4),
                "ml_ortho": round(ml_ortho, 4),
                "beta": round(beta, 4),
                "r_squared": round(r_sq, 4),
                "explained_by_gamma_pct": ortho.get("explained_by_gamma_pct", 0),
            }
            print(f"  P1 Ortho: ML raw={ml_pred:+.3f}% → ortho={ml_ortho:+.3f}% "
                  f"(β={beta:.3f}, R²={r_sq:.3f}, γ explains {ortho.get('explained_by_gamma_pct', 0):.1f}%)")
        else:
            ortho_info = {"active": False, "reason": f"β={beta:.3f} or R²={r_sq:.3f} too small"}
            print(f"  P1 Ortho: skipped (β={beta:.3f}, R²={r_sq:.3f} — insignificant)")

    # ── P1: Calibration info ─────────────────────────────────────────────
    calibration_info = None
    if calibration and calibration.get("status") == "calibrated":
        cal_weights = calibration.get("calibrated_weights", {})
        shifts = calibration.get("shifts", {})
        calibration_info = {
            "active": True,
            "weights": cal_weights,
            "shifts": shifts,
            "component_ics": calibration.get("component_ics", {}),
        }
        print(f"  P1 Calibration: {' | '.join(f'{k}={v:.3f}' for k, v in cal_weights.items())}")
        print(f"  P1 Shifts:      {' | '.join(f'{k}={v:+.3f}' for k, v in shifts.items())}")
    else:
        calibration_info = {"active": False}

    # ── Step 1: Conflict score (uses ortho ML if available) ──────────────
    conflict = compute_conflict_score(gamma_score, ml_for_routing)
    print(f"  γ={gamma_score:.0f} ({_gamma_direction(gamma_score)}), "
          f"ML={ml_for_routing:+.3f}% ({_ml_direction(ml_for_routing)}), "
          f"Conflict={conflict:.3f}")

    # ── Step 2: Regime routing ───────────────────────────────────────────
    regime_state = determine_regime_state(regime_result, conflict, vix_z)
    print(f"  Regime state: {regime_state}")

    # ── Step 3: Route signal (v2: IC-adaptive) ─────────────────────────────
    if regime_state == "crisis":
        decision = route_crisis()
    elif regime_state == "policy_shock":
        decision = route_policy_shock(gamma_score)
    elif regime_state == "transition":
        decision = route_transition(gamma_score, ml_for_routing, rolling_ic=rolling_ic)
    else:
        decision = route_normal(gamma_score, ml_for_routing, rolling_ic=rolling_ic)

    print(f"  Decision: {decision['action']} (size={decision['size_mult']:.0%}, "
          f"source={decision['source']}, matrix={decision.get('matrix_mode', 'n/a')})")

    # ── Step 4: Conflict diagnosis ───────────────────────────────────────
    diagnosis = diagnose_conflict(gamma_components, shap_factors, conflict)
    if diagnosis.get("has_conflict"):
        print(f"  ⚠ {diagnosis['diagnosis']}")

    # Build unified signal
    unified = {
        "date": date,
        "dxy_price": round(dxy_price, 2),

        # Input signals
        "gamma_score": round(gamma_score, 1),
        "gamma_signal": "BULLISH" if gamma_score >= 65 else "BEARISH" if gamma_score < 35 else "NEUTRAL",
        "ml_prediction": round(ml_pred, 4),
        "ml_signal": _ml_direction(ml_pred).upper(),

        # P1: Orthogonalized ML
        "ml_ortho": round(ml_for_routing, 4) if ml_for_routing != ml_pred else None,

        # Conflict analysis (computed on ortho ML if available)
        "conflict_score": conflict,
        "conflict_level": (
            "high" if conflict > 0.6 else
            "medium" if conflict > 0.3 else
            "low"
        ),

        # Regime
        "regime_state": regime_state,
        "regime_detail": {
            "regime": regime_result.get("regime", "unknown"),
            "multiplier": regime_result.get("multiplier", 1.0),
        },

        # Unified decision (v2: IC-adaptive)
        "action": decision["action"],
        "size_mult": decision["size_mult"],
        "stop_mult": decision["stop_mult"],
        "signal_source": decision["source"],
        "matrix_mode": decision.get("matrix_mode", "balanced"),
        "rolling_ic": round(rolling_ic, 4),

        # Conflict diagnosis
        "diagnosis": diagnosis,

        # Matrix position (for dashboard display)
        "matrix_position": {
            "gamma_dir": decision.get("gamma_dir", ""),
            "ml_dir": decision.get("ml_dir", ""),
        },

        # P1: Calibration & Orthogonalization metadata
        "p1_calibration": calibration_info,
        "p1_orthogonalization": ortho_info,
    }

    _save_json(unified, "unified_signal.json")

    print(f"\n[router] Unified Signal: {unified['action']} "
          f"({unified['signal_source']}, conflict={conflict:.2f})")

    return unified


if __name__ == "__main__":
    # Demo with mock data
    result = route_signal(
        gamma_score=75,
        gamma_components={"rf": 72, "pi_risk": 45, "cy": 55, "sigma": 68},
        ml_pred=-0.8,
        shap_factors=[
            {"name": "利率差 (Fed−ECB)", "shap_value": 0.3, "factor_value": 1.2},
            {"name": "风险情绪 (VIX)", "shap_value": -0.8, "factor_value": 2.1},
            {"name": "美元动量 (20d)", "shap_value": -0.4, "factor_value": -0.9},
        ],
        regime_result={"regime": "Reflation", "multiplier": 1.05},
        vix_z=0.8,
        dxy_price=103.24,
        date="2026-04-08",
    )
    print("\n=== Demo: γ=75(BULL) vs ML=-0.8%(SELL) ===")
    print(f"  Action: {result['action']}")
    print(f"  Source: {result['signal_source']}")
    print(f"  Conflict: {result['conflict_score']} ({result['conflict_level']})")
    print(f"  Diagnosis: {result['diagnosis'].get('diagnosis', 'N/A')}")
