"""
USD Monitor Phase 2 — Historical Data Fetching
Fetches multi-year daily time series for ML training.
Separate from fetch_data.py which handles daily snapshots for Phase 1.
"""
import os, pickle, time
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from fredapi import Fred

# Reuse Phase 1 config for API keys and series definitions
from config import FRED_API_KEY, FRED_SERIES, CENTRAL_BANK_RATES
from config_v2 import DATA_START, DATA_CACHE_PATH, CACHE_TTL_HOURS


# ── ECB Rate Decision History (public knowledge) ──────────────────────────
# Format: (date_string, rate_value)
# Source: ECB press releases — main refinancing rate
ECB_RATE_DECISIONS = [
    ("2015-01-01", 0.05),
    ("2016-03-16", 0.00),
    ("2022-07-27", 0.50),
    ("2022-09-14", 1.25),
    ("2022-11-02", 2.00),
    ("2022-12-21", 2.50),
    ("2023-02-08", 3.00),
    ("2023-03-22", 3.50),
    ("2023-05-10", 3.75),
    ("2023-06-21", 4.00),
    ("2023-08-02", 4.25),
    ("2023-09-20", 4.50),
    ("2023-10-26", 4.50),
    ("2024-06-12", 4.25),
    ("2024-09-18", 3.65),
    ("2024-10-23", 3.40),
    ("2024-12-18", 3.15),
    ("2025-01-30", 2.90),
    ("2025-03-12", 2.65),
]


def _build_ecb_rate_series(start: str, end: str) -> pd.Series:
    """Build daily ECB rate series from step-function of rate decisions."""
    dates = pd.bdate_range(start, end)
    ecb = pd.Series(np.nan, index=dates, name="ECB_RATE")

    for date_str, rate in ECB_RATE_DECISIONS:
        dt = pd.Timestamp(date_str)
        ecb.loc[ecb.index >= dt] = rate

    # Override latest with env var if available
    current_rate = CENTRAL_BANK_RATES.get("ecb", None)
    if current_rate is not None:
        last_decision = ECB_RATE_DECISIONS[-1][0]
        ecb.loc[ecb.index >= pd.Timestamp(last_decision)] = current_rate

    return ecb.ffill()


def fetch_fred_history(start: str, end: str) -> pd.DataFrame:
    """Fetch all FRED series as daily time series."""
    fred = Fred(api_key=FRED_API_KEY)
    frames = {}

    series_map = {
        "FEDFUNDS":      FRED_SERIES["fedfunds"],
        "DGS2":          FRED_SERIES["dgs2"],
        "DGS10":         FRED_SERIES["dgs10"],
        "DFII10":        FRED_SERIES["tips10y"],
        "T10YIE":        FRED_SERIES["bei10y"],
        "T5YIE":         FRED_SERIES["bei5y"],
        "SOFR":          FRED_SERIES["sofr"],
        "IORB":          FRED_SERIES["iorb"],
        "BAMLC0A4CBBB":  FRED_SERIES["bbb_spread"],
        "T5YIFR":        FRED_SERIES["fwd5y5y"],
    }

    for col_name, series_id in series_map.items():
        try:
            s = fred.get_series(series_id, observation_start=start, observation_end=end)
            s.name = col_name
            frames[col_name] = s
            print(f"  FRED {col_name}: {len(s)} obs")
        except Exception as e:
            print(f"  FRED {col_name} FAILED: {e}")

    if not frames:
        raise RuntimeError("No FRED data fetched")

    df = pd.DataFrame(frames)
    # Reindex to business days and forward-fill (max 5 days)
    bdays = pd.bdate_range(start, end)
    df = df.reindex(bdays).ffill(limit=5)
    return df


def fetch_yahoo_history(start: str, end: str) -> pd.DataFrame:
    """Fetch DXY OHLC, VIX, MOVE via yfinance."""
    import yfinance as yf

    tickers = {
        "DXY": "DX-Y.NYB",
        "VIX": "^VIX",
        "MOVE": "^MOVE",
        # σ_alert factor data sources (v3 merge)
        "VVIX": "^VVIX",
        "VXN": "^VXN",
        "OVX": "^OVX",
        "GVZ": "^GVZ",
        "HYG": "HYG",
        "QQQ": "QQQ",
        "SPY": "SPY",
    }

    frames = {}
    for name, ticker in tickers.items():
        try:
            data = yf.download(ticker, start=start, end=end, progress=False)
            if data.empty:
                print(f"  Yahoo {name}: empty")
                continue

            # Handle MultiIndex columns from yfinance
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            if name == "DXY":
                frames["DXY_close"] = data["Close"]
                frames["DXY_high"] = data["High"]
                frames["DXY_low"] = data["Low"]
                frames["DXY_open"] = data["Open"]
            elif name == "HYG":
                frames["HYG_close"] = data["Close"]
            elif name in ("QQQ", "SPY"):
                frames[f"{name}_close"] = data["Close"]
            else:
                frames[f"{name}_close"] = data["Close"]

            print(f"  Yahoo {name}: {len(data)} obs")
        except Exception as e:
            print(f"  Yahoo {name} FAILED: {e}")

    if not frames:
        raise RuntimeError("No Yahoo data fetched")

    df = pd.DataFrame(frames)
    bdays = pd.bdate_range(start, end)
    df = df.reindex(bdays).ffill(limit=5)
    return df


def fetch_all_history(force_refresh: bool = False) -> pd.DataFrame:
    """
    Fetch and merge all historical data. Caches to disk with TTL.
    Returns DataFrame with columns for all raw data series.
    """
    # Check cache
    if not force_refresh and DATA_CACHE_PATH.exists():
        cache_age = time.time() - DATA_CACHE_PATH.stat().st_mtime
        if cache_age < CACHE_TTL_HOURS * 3600:
            print(f"[fetch] Using cached data ({cache_age/3600:.1f}h old)")
            return pd.read_pickle(DATA_CACHE_PATH)

    end = datetime.now().strftime("%Y-%m-%d")
    print(f"[fetch] Fetching historical data {DATA_START} to {end}")

    # Fetch all sources
    print("[fetch] FRED series...")
    fred_df = fetch_fred_history(DATA_START, end)

    print("[fetch] Yahoo Finance...")
    yahoo_df = fetch_yahoo_history(DATA_START, end)

    print("[fetch] ECB rate history...")
    ecb_series = _build_ecb_rate_series(DATA_START, end)

    # Merge on business day index
    df = fred_df.join(yahoo_df, how="outer").join(
        ecb_series.to_frame(), how="outer"
    )

    # Forward-fill remaining gaps
    df = df.ffill(limit=5)

    # Drop rows where DXY or key rates are completely missing
    required = ["DXY_close", "FEDFUNDS", "DGS10"]
    available = [c for c in required if c in df.columns]
    if available:
        df = df.dropna(subset=available, how="all")

    print(f"[fetch] Final dataset: {len(df)} rows, {len(df.columns)} columns")
    print(f"[fetch] Date range: {df.index.min()} to {df.index.max()}")
    print(f"[fetch] Columns: {list(df.columns)}")

    # Cache
    df.to_pickle(DATA_CACHE_PATH)
    print(f"[fetch] Cached to {DATA_CACHE_PATH}")

    return df


if __name__ == "__main__":
    df = fetch_all_history(force_refresh=True)
    print("\n=== Data Summary ===")
    print(df.describe())
    print("\nNull counts:")
    print(df.isnull().sum())
