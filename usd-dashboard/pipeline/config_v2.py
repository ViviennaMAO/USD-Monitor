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

# ── 10-Factor Universe ─────────────────────────────────────────────────────
FACTOR_COLS = [
    "F1_RateDiff",          # Fed-ECB rate differential
    "F2_RealRate",          # TIPS 10Y real rate
    "F3_TermSpread",        # 10Y-2Y yield curve slope
    "F4_VIX",               # Equity risk sentiment
    "F5_BEI",               # 10Y breakeven inflation
    "F6_RatePath",          # 2Y vs Fed Funds (market rate expectations)
    "F7_DXYMomentum",       # DXY 20-day momentum
    "F8_CreditSpread",      # BBB OAS credit conditions
    "F9_VolSpread",         # VIX-MOVE equity/bond vol divergence
    "F10_FundingStress",    # SOFR-IORB dollar funding stress
]

FACTOR_DISPLAY = {
    "F1_RateDiff":       "利率差 (Fed−ECB)",
    "F2_RealRate":       "实际利率 (TIPS 10Y)",
    "F3_TermSpread":     "期限利差 (10Y−2Y)",
    "F4_VIX":            "风险情绪 (VIX)",
    "F5_BEI":            "通胀预期 (BEI 10Y)",
    "F6_RatePath":       "利率路径 (2Y−FFR)",
    "F7_DXYMomentum":    "美元动量 (20d)",
    "F8_CreditSpread":   "信用利差 (BBB OAS)",
    "F9_VolSpread":      "波动率差 (VIX−MOVE)",
    "F10_FundingStress": "资金压力 (SOFR−IORB)",
}

# Short IDs for API (matches ic_tracking_F1.json etc.)
FACTOR_SHORT_IDS = {f: f.split("_")[0] for f in FACTOR_COLS}
# e.g. {"F1_RateDiff": "F1", ...}

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
