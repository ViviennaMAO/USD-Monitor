"""
USD Monitor Phase 2 — ML Pipeline Configuration
Separate from config.py to preserve Phase 1 pipeline integrity.
"""
import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
MODEL_PATH = BASE_DIR / "model_dxy.json"
DATA_CACHE_PATH = BASE_DIR / "data_cache.pkl"

# ── Data Parameters ────────────────────────────────────────────────────────
DATA_START = "2015-01-01"
TRAIN_END = "2025-09-30"
FORWARD_DAYS = 20          # 20-day forward return target
ZSCORE_WINDOW = 252         # 1 year rolling Z-score
ZSCORE_CLIP = 5.0           # Clip Z-scores to [-5, 5]
CACHE_TTL_HOURS = 20        # Refetch if cache older than this

# ── Training Strategy (v2: regime-aware) ──────────────────────────────────
# Addresses 3.1 (CV expanding window) + 3.3 (IC decay via regime drift)
CV_MODE = "sliding"              # "expanding" (old) or "sliding"
CV_WINDOW_DAYS = 756             # 3 years rolling train window for sliding mode
CV_N_SPLITS = 5

# Sample weight decay — recent samples get more weight
SAMPLE_WEIGHT_DECAY = True
SAMPLE_WEIGHT_HALFLIFE_DAYS = 504  # 2-year half-life

# Regime-aware factor gating — mask factors with negative per-regime IC at inference
REGIME_FACTOR_GATE = True
REGIME_FACTOR_MIN_IC = -0.15      # Block factors with IC < -0.15 in current regime
REGIME_FACTOR_MIN_OBS = 40        # Minimum obs to trust regime IC

# CPCV configuration (addresses 3.2)
CPCV_N_BLOCKS_V2 = 8              # Was 6 → finer regime resolution

# ── 10-Factor Universe (v2: post-bias-audit) ──────────────────────────────
# Changes from v1:
#   F2: level → Δ20d (fix Real Rate Illusion bias)
#   F6: RatePath → YCMomentum (fix redundancy with F1, ICIR=-1.91)
#   F7: DXYMomentum → RateVol (fix target leakage, ICIR=-2.16)
#   F8: CreditSpread → CreditResidual (orthogonalize vs F4 VIX, ρ=0.583)
FACTOR_COLS = [
    "F1_RateDiff",          # Fed-ECB rate differential
    "F2_RealRateDelta",     # TIPS 10Y 20d change (was: level)
    "F3_TermSpread",        # 10Y-2Y yield curve slope
    "F4_VIX",               # Equity risk sentiment
    "F5_BEI",               # 10Y breakeven inflation
    "F6_YCMomentum",        # Yield curve flattening speed (was: RatePath)
    "F7_LongYieldDelta",    # 10Y yield 20d change (was: DXYMomentum)
    "F8_CreditResidual",    # BBB OAS orthogonalized vs VIX (was: raw CreditSpread)
    "F9_VolSpread",         # VIX-MOVE equity/bond vol divergence
    "F10_FundingStress",    # SOFR-IORB dollar funding stress
]

# ── 12 σ_alert Factors (v3: merged into training) ────────────────────────
# Previously only computed in TypeScript (scoring.ts) for display.
# Now ported to Python and included in ML training pipeline.
# Naming: σ prefix to distinguish from F-series fundamentals.
SIGMA_FACTOR_COLS = [
    "σ1_RiskReversal",       # 3M 25D RR proxy (DXY residual z-score)
    "σ2_FxRateResidual",     # FX rate-spread residual (|DXY residual| z)
    "σ3_OVX",                # Oil volatility (OVX percentile)
    "σ4_VVIX_VIX",           # Vol-of-vol ratio (VVIX/VIX)
    "σ5_VXN_VIX",            # Tech-equity vol gap (VXN − VIX)
    "σ6_VXHYG",              # High-yield implied vol (HYG realized vol)
    "σ7_GVZ",                # Gold volatility
    "σ8_RR_Residual",        # RR × Residual resonance (cross-factor)
    "σ9_Stagflation",        # OVX × TIPS stagflation pressure
    "σ10_TailRisk",          # VVIX/VIX × RR tail directional
    "σ11_TechSpillover",     # VXN-VIX × QQQ/SPY divergence
    "σ12_CreditRepair",      # VXHYG × CDS credit repair signal
]

# Combined factor universe for training
ALL_FACTOR_COLS = FACTOR_COLS + SIGMA_FACTOR_COLS  # 22 total

FACTOR_DISPLAY = {
    "F1_RateDiff":        "利率差 (Fed−ECB)",
    "F2_RealRateDelta":   "实际利率变化 (TIPS Δ20d)",
    "F3_TermSpread":      "期限利差 (10Y−2Y)",
    "F4_VIX":             "风险情绪 (VIX)",
    "F5_BEI":             "通胀预期 (BEI 10Y)",
    "F6_YCMomentum":      "曲线动量 (利差Δ20d)",
    "F7_LongYieldDelta":  "长端利率动量 (10YΔ20d)",
    "F8_CreditResidual":  "信用残差 (BBB⊥VIX)",
    "F9_VolSpread":       "波动率差 (VIX−MOVE)",
    "F10_FundingStress":  "资金压力 (SOFR−IORB)",
    # σ_alert factors
    "σ1_RiskReversal":    "风险反转 (RR proxy)",
    "σ2_FxRateResidual":  "汇率残差 (DXY⊥利差)",
    "σ3_OVX":             "原油波动率 (OVX)",
    "σ4_VVIX_VIX":        "恐慌溢价 (VVIX/VIX)",
    "σ5_VXN_VIX":         "科技分化 (VXN−VIX)",
    "σ6_VXHYG":           "高收益波动 (HYG RV)",
    "σ7_GVZ":             "黄金波动率 (GVZ)",
    "σ8_RR_Residual":     "RR×残差共振",
    "σ9_Stagflation":     "滞胀压力 (OVX×TIPS)",
    "σ10_TailRisk":       "尾部风险 (VVIX/VIX×RR)",
    "σ11_TechSpillover":  "科技溢出 (VXN-VIX×β)",
    "σ12_CreditRepair":   "信用修复 (VXHYG×CDS)",
}

# Short IDs for API (matches ic_tracking_F1.json etc.)
FACTOR_SHORT_IDS = {f: f.split("_")[0] for f in FACTOR_COLS}
# σ factors: use full prefix as ID (σ1, σ2, ...)
SIGMA_SHORT_IDS = {f: f.split("_")[0] for f in SIGMA_FACTOR_COLS}
ALL_SHORT_IDS = {**FACTOR_SHORT_IDS, **SIGMA_SHORT_IDS}

# ── XGBoost Hyperparameters (conservative, matching GoldMonitor) ───────────
XGB_PARAMS = {
    "max_depth": 4,
    "min_child_weight": 15,
    "learning_rate": 0.03,
    "n_estimators": 500,
    "subsample": 0.7,
    "colsample_bytree": 0.7,
    "reg_alpha": 0.3,
    "reg_lambda": 2.0,
    "objective": "reg:squarederror",
    "random_state": 42,
}

# ── Signal Thresholds (tighter than gold — DXY moves ~1-3% over 20d) ──────
SIGNAL_THRESHOLDS = {
    "strong_buy":  1.0,     # DXY expected to rise > 1%
    "buy":         0.4,
    "sell":       -0.4,
    "strong_sell": -1.0,
}

# ── Position Sizing ────────────────────────────────────────────────────────
ATR_PERIOD = 14
ATR_STOP_MULT = 3.5
RISK_BUDGET = 0.015         # 1.5% per trade
ACCOUNT_EQUITY = 100_000.0
MIN_HOLD_DAYS = 3
TRADE_COST_BPS = 3

# ── Kelly Criterion ────────────────────────────────────────────────────────
KELLY_PHASE1_RISK = 0.01   # Fixed 1% until 50 trades
KELLY_PHASE1_N = 50
KELLY_FRACTION = 0.25       # 1/4 Kelly
KELLY_MIN_RISK = 0.003
KELLY_MAX_RISK = 0.05
SIGNAL_GRADE_MULT = {
    "Strong Buy": 1.00, "Strong Sell": 1.00,
    "Buy": 0.60, "Sell": 0.60,
    "Neutral": 0.00,
}

# ── Circuit Breaker ────────────────────────────────────────────────────────
DRAWDOWN_REDUCE_HALF = 0.05
DRAWDOWN_PAUSE = 0.08
DRAWDOWN_PAUSE_DAYS = 20
DRAWDOWN_LIQUIDATE = 0.15
IC_HIBERNATE = 0.05
IC_FULL_SIGNAL = 0.15
IC_WINDOW = 60

# ── Regime: L1 Macro Quadrant (USD-inverted from gold) ─────────────────────
QUADRANT_MULT = {
    "Stagflation":  0.65,   # Growth↓ Inflation↑ → worst for USD
    "Overheating":  0.85,   # Growth↑ Inflation↑ → mixed
    "Deflation":    1.00,   # Growth↓ Inflation↓ → flight to safety, USD up
    "Reflation":    1.10,   # Growth↑ Inflation↓ → Goldilocks, best for USD
    "Neutral":      0.85,
}

FED_CYCLE_ADJ = {
    "Tightening": +0.15,    # Bullish USD (inverted from gold's -0.15)
    "Easing":     -0.15,
    "Neutral":     0.00,
}

# ── Regime: L2 HMM ────────────────────────────────────────────────────────
HMM_N_STATES = 3
HMM_LOOKBACK = 504          # 2 years rolling
HMM_BASE_FACTORS = ["F1_RateDiff", "F4_VIX", "F5_BEI", "F3_TermSpread"]

# ── Factor Audit Metadata (for dashboard display) ─────────────────────────
FACTOR_AUDIT_LOG = {
    "F2": "v1→level, v2→Δ20d: 消除实际利率幻觉偏见",
    "F6": "v1→RatePath(ICIR=-1.91), v2→YCMomentum: 消除与F1的共线性",
    "F7": "v1→DXYMomentum(ICIR=-2.16)→RateVol(ρ=0.93 vs F9)→LongYieldDelta: ρ=0.87 vs F2 acceptable (XGBoost handles collinearity, OOS IC +0.009)",
    "F8": "v1→CreditSpread(ρ=0.583 vs F4), v2→CreditResidual: 正交化去重",
}

LIQVOL_MULT = {
    "Trending":      1.05,
    "Crisis Spike":  0.80,
    "Grinding":      0.92,
    "Systemic Risk": 0.65,
}

# ── Regime: L3 Events ─────────────────────────────────────────────────────
RATE_SHOCK_THRESHOLD = 1.0  # Z-score threshold for 2Y yield shocks
CHANGEPOINT_PENALTY = 3.0
CHANGEPOINT_LOOKBACK = 60
CHANGEPOINT_RECENT_DAYS = 5

# Dollar Smile deltas (USD-specific)
SMILE_DELTA = {
    "risk_off":   +0.10,    # DXY strong + VIX high → safe haven
    "growth":     +0.05,    # DXY strong + VIX low → growth premium
    "mild_risk_on": -0.05,  # DXY weak + VIX moderate → carry unwind
    "us_crisis":  -0.15,    # DXY weak + VIX very high → US-specific
}

# ── CPCV ───────────────────────────────────────────────────────────────────
CPCV_N_BLOCKS = 6
CPCV_N_TEST = 2             # C(6,2) = 15 paths

# ── Multi-Scale ────────────────────────────────────────────────────────────
HORIZONS = [10, 20, 40]

# ── Regime Labels for IC Tracking ──────────────────────────────────────────
REGIME_DATE_LABELS = [
    ("2025-09-18", "加息期"),
    ("2026-01-15", "降息期"),
    (None,         "震荡期"),
]
