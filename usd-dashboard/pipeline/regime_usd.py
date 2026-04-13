"""
USD Monitor Phase 2 — Three-Layer Regime Detection
Adapted from GoldMonitor's regime_v2.py with USD-inverted logic.

L1: Macro Quadrant (Growth × Inflation) + Fed Cycle — monthly frequency
L2: HMM Market Microstructure + Liquidity-Volatility Matrix — weekly
L3: Event Overlay (Rate Shock + Changepoint + Dollar Smile) — daily
"""
import warnings
import numpy as np
import pandas as pd

from config_v2 import (
    QUADRANT_MULT, FED_CYCLE_ADJ, LIQVOL_MULT,
    HMM_N_STATES, HMM_LOOKBACK, HMM_BASE_FACTORS,
    RATE_SHOCK_THRESHOLD, CHANGEPOINT_PENALTY,
    CHANGEPOINT_LOOKBACK, CHANGEPOINT_RECENT_DAYS,
    SMILE_DELTA, ALL_FACTOR_COLS as FACTOR_COLS,
)

warnings.filterwarnings("ignore", category=DeprecationWarning)

# ── Quadrant names in Chinese ──────────────────────────────────────────────
QUADRANT_CN = {
    "Stagflation": "滞胀",
    "Overheating": "过热",
    "Deflation":   "通缩",
    "Reflation":   "再通胀",
    "Neutral":     "中性",
}


# ══════════════════════════════════════════════════════════════════════════
# Layer 1: Macro Quadrant + Fed Cycle
# ══════════════════════════════════════════════════════════════════════════

def _detect_layer1(row: pd.Series) -> dict:
    """
    Macro regime from Growth × Inflation quadrant + Fed cycle overlay.
    Uses yield curve slope for growth and BEI momentum for inflation.
    """
    # Growth direction: yield curve Z-score + momentum
    yc_z = row.get("yield_curve_z", 0.0)
    yc_mom_z = row.get("yield_curve_mom_z", 0.0)
    growth_up = (yc_z > 0.3) or (yc_mom_z > 0.3)
    growth_down = (yc_z < -0.3) or (yc_mom_z < -0.3)

    # Inflation direction: BEI level Z + 20d momentum
    bei_z = row.get("F5_BEI", 0.0)
    bei_mom = row.get("bei_momentum_20d", 0.0)
    inflation_up = (bei_z > 0.3) and (bei_mom is not None and bei_mom > 0.02)
    inflation_down = (bei_z < -0.3) or (bei_mom is not None and bei_mom < -0.02)

    # Quadrant classification
    if growth_down and inflation_up:
        quadrant = "Stagflation"
    elif growth_up and inflation_up:
        quadrant = "Overheating"
    elif growth_down and inflation_down:
        quadrant = "Deflation"
    elif growth_up and inflation_down:
        quadrant = "Reflation"
    else:
        quadrant = "Neutral"

    quad_mult = QUADRANT_MULT[quadrant]

    # Fed cycle overlay
    dgs2 = row.get("raw_DGS2", None)
    ffr = row.get("raw_FEDFUNDS", None)

    fed_cycle = "Neutral"
    fed_adj = 0.0
    if dgs2 is not None and ffr is not None:
        rate_path = dgs2 - ffr
        if rate_path > 0.3:
            fed_cycle = "Tightening"
        elif rate_path < -0.3:
            fed_cycle = "Easing"

    fed_adj = FED_CYCLE_ADJ[fed_cycle]

    l1_mult = np.clip(quad_mult + fed_adj, 0.30, 1.40)

    return {
        "quadrant": quadrant,
        "quadrant_cn": QUADRANT_CN[quadrant],
        "quad_mult": round(float(quad_mult), 2),
        "fed_cycle": fed_cycle,
        "fed_adj": round(float(fed_adj), 2),
        "multiplier": round(float(l1_mult), 2),
    }


# ══════════════════════════════════════════════════════════════════════════
# Layer 2: HMM + Liquidity-Volatility Matrix
# ══════════════════════════════════════════════════════════════════════════

def _detect_layer2(features_df: pd.DataFrame, row_idx: int) -> dict:
    """
    Market microstructure regime via HMM + Liquidity-Volatility matrix.
    """
    result = {
        "hmm_state": "Neutral",
        "hmm_confidence": 0.5,
        "liqvol_regime": "Grinding",
        "adj_factor": 1.0,
    }

    # HMM — requires hmmlearn
    try:
        from hmmlearn.hmm import GaussianHMM

        # Get lookback window
        start_idx = max(0, row_idx - HMM_LOOKBACK)
        window_df = features_df.iloc[start_idx:row_idx + 1]

        # Use base factors for HMM
        available_factors = [f for f in HMM_BASE_FACTORS if f in window_df.columns]
        if len(available_factors) < 3 or len(window_df) < 100:
            raise ValueError("Insufficient data for HMM")

        X_hmm = window_df[available_factors].fillna(0).values

        model = GaussianHMM(
            n_components=HMM_N_STATES,
            covariance_type="diag",
            n_iter=150,
            tol=0.005,
            random_state=42,
        )
        model.fit(X_hmm)

        current_state = int(model.predict(X_hmm)[-1])
        state_probs = model.predict_proba(X_hmm)[-1]
        confidence = float(state_probs.max())

        # Label states by examining DXY forward returns within each state
        if "target" in window_df.columns:
            states = model.predict(X_hmm)
            state_returns = {}
            for s in range(HMM_N_STATES):
                mask = states == s
                rets = window_df["target"].values[mask]
                valid_rets = rets[~np.isnan(rets)]
                state_returns[s] = float(np.mean(valid_rets)) if len(valid_rets) > 0 else 0.0

            # Sort states by mean return
            sorted_states = sorted(state_returns.items(), key=lambda x: x[1])
            state_labels = {}
            state_labels[sorted_states[0][0]] = "Bear"
            state_labels[sorted_states[-1][0]] = "Bull"
            for s in range(HMM_N_STATES):
                if s not in state_labels:
                    state_labels[s] = "Neutral"

            result["hmm_state"] = state_labels.get(current_state, "Neutral")
        else:
            result["hmm_state"] = "Neutral"

        result["hmm_confidence"] = round(confidence, 2)

    except Exception:
        pass  # HMM failed, use defaults

    # Liquidity-Volatility Matrix
    row = features_df.iloc[row_idx]
    vix_z = row.get("F4_VIX", 0.0)
    vix_mom_z = row.get("vix_momentum_z", 0.0)
    credit_z = row.get("F8_CreditResidual", row.get("F8_CreditSpread", 0.0))
    yield_delta = row.get("F7_LongYieldDelta", 0.0)

    vol_high = (vix_z > 1.0) or (vix_z > 0.5 and vix_mom_z > 0.5)
    liq_good = (credit_z < 0) or (yield_delta > 0)  # Narrowing credit residual or rising yields (USD-positive)

    if not vol_high and liq_good:
        liqvol = "Trending"
    elif vol_high and liq_good:
        liqvol = "Crisis Spike"
    elif not vol_high and not liq_good:
        liqvol = "Grinding"
    else:
        liqvol = "Systemic Risk"

    result["liqvol_regime"] = liqvol
    liqvol_mult = LIQVOL_MULT[liqvol]

    # HMM × Liquidity-Vol adjustment
    hmm_mult = {"Bull": 1.05, "Neutral": 1.00, "Bear": 0.90}.get(
        result["hmm_state"], 1.0
    )
    result["adj_factor"] = round(
        float(np.clip(hmm_mult * liqvol_mult, 0.50, 1.15)), 2
    )

    return result


# ══════════════════════════════════════════════════════════════════════════
# Layer 3: Event Overlay
# ══════════════════════════════════════════════════════════════════════════

def _detect_layer3(features_df: pd.DataFrame, row_idx: int) -> dict:
    """
    Event-driven daily adjustments:
    1. Rate Shock Attribution (2Y yield)
    2. Changepoint Detection (PELT)
    3. Dollar Smile Distinction
    """
    row = features_df.iloc[row_idx]
    delta = 0.0
    events = []

    # ── 3.1 Rate Shock Attribution ─────────────────────────────────────
    # v2: use YC momentum (yield curve flattening speed) instead of deprecated RatePath
    rate_shock_z = row.get("F6_YCMomentum", row.get("F6_RatePath", 0.0))
    if abs(rate_shock_z) > RATE_SHOCK_THRESHOLD:
        dxy_eff = row.get("dxy_efficiency", 0.5)
        dxy_atr_r = row.get("dxy_atr_ratio", 1.0)
        dxy_sideways = (dxy_eff < 0.35) or (dxy_atr_r < 0.75)
        vix_z = row.get("F4_VIX", 0.0)

        if vix_z > 0.8 and dxy_sideways:
            # Fragility shock (like SVB) — USD benefits as safe haven
            shock_delta = +0.10
            shock_type = "fragility"
        elif row.get("F5_BEI", 0.0) > 0.5:
            # Inflation repricing
            shock_delta = +0.05
            shock_type = "inflation"
        else:
            # Fed repricing — higher rates expected
            shock_delta = +0.10 if rate_shock_z > 0 else -0.10
            shock_type = "expectation"

        delta += shock_delta
        events.append(f"rate_shock:{shock_type}({shock_delta:+.2f})")

    # ── 3.2 Changepoint Detection (PELT) ───────────────────────────────
    changepoint_detected = False
    try:
        import ruptures as rpt

        start = max(0, row_idx - CHANGEPOINT_LOOKBACK)
        prices = features_df["dxy_price"].iloc[start:row_idx + 1].dropna()
        if len(prices) >= 30:
            log_rets = np.log(prices / prices.shift(1)).dropna().values
            if len(log_rets) >= 20:
                algo = rpt.Pelt(model="rbf", min_size=5, jump=1)
                algo.fit(log_rets.reshape(-1, 1))
                bkps = algo.predict(pen=CHANGEPOINT_PENALTY)

                # Check if breakpoint is recent
                for bp in bkps[:-1]:  # Exclude the last (= length)
                    days_ago = len(log_rets) - bp
                    if days_ago <= CHANGEPOINT_RECENT_DAYS:
                        changepoint_detected = True
                        delta -= 0.10
                        events.append("changepoint(-0.10)")
                        break
    except Exception:
        pass  # ruptures not available or data issue

    # ── 3.3 Dollar Smile Distinction ───────────────────────────────────
    # v2: use DXY efficiency + ATR ratio instead of deleted F7_DXYMomentum
    dxy_eff = row.get("dxy_efficiency", 0.5)
    dxy_atr_r = row.get("dxy_atr_ratio", 1.0)
    dxy_trending_up = (dxy_eff > 0.4) and (dxy_atr_r > 1.0)
    dxy_trending_dn = (dxy_eff > 0.4) and (dxy_atr_r < 0.8)
    vix_z = row.get("F4_VIX", 0.0)

    if dxy_trending_up:
        # USD strengthening
        if vix_z > 0.5:
            # Risk-off USD strength (safe haven)
            smile_delta = SMILE_DELTA["risk_off"]
            smile_type = "risk_off"
        else:
            # Growth-driven USD strength
            smile_delta = SMILE_DELTA["growth"]
            smile_type = "growth"
    elif dxy_trending_dn:
        # USD weakening
        if vix_z > 1.5:
            # US-specific crisis (DXY down + VIX very high)
            smile_delta = SMILE_DELTA["us_crisis"]
            smile_type = "us_crisis"
        else:
            # Mild risk-on / carry unwind
            smile_delta = SMILE_DELTA["mild_risk_on"]
            smile_type = "mild_risk_on"
    else:
        smile_delta = 0.0
        smile_type = "neutral"

    delta += smile_delta
    if smile_delta != 0:
        events.append(f"smile:{smile_type}({smile_delta:+.2f})")

    return {
        "overlay_delta": round(float(np.clip(delta, -0.35, 0.25)), 2),
        "events": events,
        "changepoint_detected": changepoint_detected,
        "smile_type": smile_type,
    }


# ══════════════════════════════════════════════════════════════════════════
# Composite: L1 × L2 + L3
# ══════════════════════════════════════════════════════════════════════════

def detect_regime_v2(features_df: pd.DataFrame, row_idx: int = -1) -> dict:
    """
    Full three-layer regime detection.
    Returns composite multiplier and all layer details.
    """
    if row_idx < 0:
        row_idx = len(features_df) + row_idx

    row = features_df.iloc[row_idx]

    l1 = _detect_layer1(row)
    l2 = _detect_layer2(features_df, row_idx)
    l3 = _detect_layer3(features_df, row_idx)

    # Composite
    composite = l1["multiplier"] * l2["adj_factor"] + l3["overlay_delta"]
    composite = float(np.clip(composite, 0.10, 1.50))

    # Regime string
    regime_en = f"{l1['quadrant']}·{l2['liqvol_regime']}"
    regime_cn = f"{l1['quadrant_cn']}·{l2['liqvol_regime']}"

    # Risk scores (for dashboard)
    risk_off_score = max(0, row.get("F4_VIX", 0)) * 20  # 0-100 proxy
    risk_on_score = max(0, -row.get("F4_VIX", 0)) * 20

    return {
        "regime": regime_cn,
        "regime_en": regime_en,
        "multiplier": round(composite, 2),
        "confidence": l2.get("hmm_confidence", 0.5),
        "risk_off_score": round(float(np.clip(risk_off_score, 0, 100)), 1),
        "risk_on_score": round(float(np.clip(risk_on_score, 0, 100)), 1),
        "layer1": l1,
        "layer2": l2,
        "layer3": l3,
        "version": "2.0-usd",
    }


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    from features import build_features
    raw = fetch_all_history()
    features = build_features(raw)
    regime = detect_regime_v2(features)
    print("\n=== Current Regime ===")
    for k, v in regime.items():
        print(f"  {k}: {v}")
