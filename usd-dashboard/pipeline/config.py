"""
USDMonitor Pipeline Config
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).parents[1] / ".env.local")

FRED_API_KEY = os.getenv("FRED_API_KEY", "")

# Central bank rates (updated manually / quarterly)
# Override via env vars for automation
CENTRAL_BANK_RATES = {
    "ecb":  float(os.getenv("ECB_RATE",  "3.00")),
    "boj":  float(os.getenv("BOJ_RATE",  "0.25")),
    "boe":  float(os.getenv("BOE_RATE",  "4.25")),
    "estr": float(os.getenv("ESTR_RATE", "2.90")),
    "sonia":float(os.getenv("SONIA_RATE","4.19")),
}

# FRED series IDs
FRED_SERIES = {
    "fedfunds": "FEDFUNDS",   # Fed Funds Rate (monthly)
    "dgs2":     "DGS2",       # 2Y Treasury
    "dgs10":    "DGS10",      # 10Y Treasury
    "tips10y":  "DFII10",     # 10Y TIPS (real rate)
    "bei10y":   "T10YIE",     # 10Y Breakeven Inflation
    "bei5y":    "T5YIE",      # 5Y Breakeven Inflation
    "dxy_tw":   "DTWEXBGS",   # Trade-weighted DXY
    "sofr":     "SOFR",       # SOFR
    "iorb":     "IORB",       # IORB
    "bbb_spread":"BAMLC0A4CBBB", # BBB spread (CDS proxy)
}

# Yahoo Finance tickers
YAHOO_TICKERS = {
    "dxy":    "DX-Y.NYB",
    "vix":    "^VIX",
    "vvix":   "^VVIX",
    "vxn":    "^VXN",
    "ovx":    "^OVX",
    "gvz":    "^GVZ",
    "move":   "^MOVE",
    "eurusd": "EURUSD=X",
    "usdjpy": "JPY=X",
    "usdcny": "CNY=X",
    "usdmxn": "MXN=X",
    "gold":   "GC=F",
    "qqq":    "QQQ",
    "spy":    "SPY",
    "hyg":    "HYG",          # For VXHYG approximation
}

# Scoring normalization ranges
SCORE_RANGES = {
    # r_f
    "tips10y":      (-1.0, 3.0),
    "rate_path":    (-2.0, 1.0),
    # π_risk
    "vix":          (12.0, 40.0),
    "term_premium": (-50.0, 350.0),   # bps
    # cy
    "gold_trend30d":(-10.0, 20.0),    # %
    "sofr_iorb":    (-10.0, 10.0),    # bps
    "dxy_residual": (-5.0, 5.0),
    # σ_alert
    "rr_zscore":    (0.0, 2.5),
    "res_zscore":   (0.0, 2.5),
    "ovx":          (50.0, 150.0),
    "vvix_vix":     (3.0, 6.0),
    "vxn_vix_gap":  (0.0, 6.0),
    "vxhyg":        (5.0, 20.0),
    "gvz":          (15.0, 45.0),
    "composite_z":  (0.0, 3.0),
    "tips_1y":      (1.0, 5.0),
    "tail_dir":     (0.0, 5.0),
    "spillover":    (0.0, 5.0),
    "credit_calm":  (0.0, 1.0),
}

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
