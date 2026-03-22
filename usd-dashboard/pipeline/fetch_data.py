"""
Fetch all raw data from FRED and Yahoo Finance.
Returns a unified dict used by the scoring engines.
"""
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import yfinance as yf
from fredapi import Fred
from datetime import datetime, timedelta
from config import FRED_API_KEY, FRED_SERIES, YAHOO_TICKERS, CENTRAL_BANK_RATES


def _normalize(val, lo, hi):
    """Linearly clamp val into [0, 1] between lo and hi."""
    return float(max(0.0, min(1.0, (val - lo) / (hi - lo))))


# ─── FRED ────────────────────────────────────────────────────────────────────

def fetch_fred() -> dict:
    """Fetch latest values from FRED series."""
    fred = Fred(api_key=FRED_API_KEY)
    end = datetime.today()
    start = end - timedelta(days=400)   # enough for 252-day rolling

    out = {}
    for key, series_id in FRED_SERIES.items():
        try:
            s = fred.get_series(series_id, observation_start=start, observation_end=end).dropna()
            if len(s) == 0:
                print(f"  [FRED] {series_id}: no data, using NaN")
                out[key] = float("nan")
                out[f"{key}_series"] = []
            else:
                out[key] = float(s.iloc[-1])
                out[f"{key}_series"] = s.tolist()
                print(f"  [FRED] {series_id}: {out[key]:.4f}")
        except Exception as e:
            print(f"  [FRED] {series_id}: ERROR {e}")
            out[key] = float("nan")
            out[f"{key}_series"] = []

    return out


# ─── Yahoo Finance ────────────────────────────────────────────────────────────

def _latest(ticker_sym: str, period: str = "5d") -> float:
    """Get the most recent closing price."""
    try:
        t = yf.Ticker(ticker_sym)
        hist = t.history(period=period)
        if hist.empty:
            return float("nan")
        return float(hist["Close"].dropna().iloc[-1])
    except Exception as e:
        print(f"  [YF] {ticker_sym}: ERROR {e}")
        return float("nan")


def _history(ticker_sym: str, period: str = "60d") -> pd.Series:
    """Get price history as a Series."""
    try:
        t = yf.Ticker(ticker_sym)
        hist = t.history(period=period)
        return hist["Close"].dropna()
    except Exception:
        return pd.Series(dtype=float)


def fetch_yahoo() -> dict:
    """Fetch latest values and short histories from Yahoo Finance."""
    out = {}

    # ── Spot prices ──────────────────────────────────────────────────────────
    for key, sym in YAHOO_TICKERS.items():
        val = _latest(sym)
        out[key] = val
        print(f"  [YF]   {sym:15s}: {val:.4f}" if not np.isnan(val) else f"  [YF]   {sym:15s}: NaN")

    # ── Previous day for change calculations ─────────────────────────────────
    for key, sym in [("vxhyg_prev", "HYG"), ("gvz_prev", "^GVZ"),
                     ("vvix_prev", "^VVIX"), ("ovx_prev", "^OVX")]:
        try:
            t = yf.Ticker(sym)
            hist = t.history(period="5d")["Close"].dropna()
            out[key] = float(hist.iloc[-2]) if len(hist) >= 2 else out.get(sym.replace("^","").lower(), float("nan"))
        except Exception:
            out[key] = float("nan")

    # ── DXY 30-day history (for score history chart) ─────────────────────────
    dxy_hist = _history(YAHOO_TICKERS["dxy"], period="60d")
    out["dxy_history"] = [
        {"date": str(d.date()), "price": round(float(p), 3)}
        for d, p in zip(dxy_hist.index[-30:], dxy_hist.values[-30:])
    ]

    # ── Gold 30d trend ────────────────────────────────────────────────────────
    gold_hist = _history(YAHOO_TICKERS["gold"], period="60d")
    if len(gold_hist) >= 30:
        gold_30d_ago = float(gold_hist.iloc[-30])
        gold_now = float(gold_hist.iloc[-1])
        out["gold_trend_30d"] = round((gold_now - gold_30d_ago) / gold_30d_ago * 100, 2)
    else:
        out["gold_trend_30d"] = float("nan")

    # ── QQQ/SPY 1d returns ────────────────────────────────────────────────────
    for key in ["qqq", "spy"]:
        try:
            hist = _history(YAHOO_TICKERS[key], period="5d")
            if len(hist) >= 2:
                out[f"{key}_ret"] = round((float(hist.iloc[-1]) - float(hist.iloc[-2])) / float(hist.iloc[-2]) * 100, 4)
            else:
                out[f"{key}_ret"] = 0.0
        except Exception:
            out[f"{key}_ret"] = 0.0

    # ── OVX 52-week series (for percentile) ─────────────────────────────────
    ovx_hist = _history(YAHOO_TICKERS["ovx"], period="1y")
    out["ovx_52w_series"] = ovx_hist.tolist() if len(ovx_hist) > 0 else [out["ovx"]]

    # ── VXHYG approximation via HYG options IV ───────────────────────────────
    # Yahoo doesn't directly provide ^VXHYG — use HYG 30-day IV proxy
    # Fall back to a fixed estimate if options data unavailable
    try:
        hyg_iv = _latest("^VXHYG")
        if np.isnan(hyg_iv):
            # Estimate from HYG recent volatility
            hyg_hist = _history("HYG", period="60d")
            if len(hyg_hist) >= 21:
                log_ret = np.log(hyg_hist / hyg_hist.shift(1)).dropna()
                hyg_iv = float(log_ret.iloc[-21:].std() * np.sqrt(252) * 100)
            else:
                hyg_iv = 12.0
        out["vxhyg"] = round(hyg_iv, 2)
    except Exception:
        out["vxhyg"] = 12.0

    if np.isnan(out.get("vxhyg_prev", float("nan"))):
        out["vxhyg_prev"] = out["vxhyg"] * 1.05   # fallback: assume ~5% higher yesterday

    # ── FX 7-day trend ────────────────────────────────────────────────────────
    fx_trend = []
    eurusd_hist = _history("EURUSD=X", period="14d").tail(7)
    usdjpy_hist = _history("JPY=X", period="14d").tail(7)
    dxy_short = _history(YAHOO_TICKERS["dxy"], period="14d").tail(7)

    dates = eurusd_hist.index if len(eurusd_hist) >= 1 else dxy_short.index
    for i, d in enumerate(dates):
        fx_trend.append({
            "date": str(d.date()),
            "eurusd": round(float(eurusd_hist.iloc[i]) if i < len(eurusd_hist) else float("nan"), 4),
            "usdjpy": round(float(usdjpy_hist.iloc[i]) if i < len(usdjpy_hist) else float("nan"), 2),
            "dxy":    round(float(dxy_short.iloc[i]) if i < len(dxy_short) else float("nan"), 2),
        })
    out["fx_trend"] = fx_trend

    return out


# ─── DXY regression residual ─────────────────────────────────────────────────

def compute_dxy_residual(fred_data: dict, yahoo_data: dict) -> dict:
    """
    Compute DXY actual vs interest-rate-implied (OLS residual, 252-day rolling).
    Returns residual, alpha, beta, implied DXY.
    """
    try:
        from scipy import stats

        # Use FRED trade-weighted DXY and 2Y spread as proxy
        dxy_series  = np.array(fred_data.get("dxy_tw_series", []))
        dgs2_series = np.array(fred_data.get("dgs2_series", []))

        n = min(len(dxy_series), len(dgs2_series), 252)
        if n < 30:
            raise ValueError(f"Not enough data: {n} points")

        y = dxy_series[-n:]
        x = dgs2_series[-n:]
        slope, intercept, *_ = stats.linregress(x, y)

        dxy_actual  = yahoo_data.get("dxy", fred_data.get("dxy_tw", float("nan")))
        fed         = fred_data.get("fedfunds", 4.50)
        ecb         = CENTRAL_BANK_RATES["ecb"]
        spread_2y_w = (fed - ecb) * 0.57 + (fed - CENTRAL_BANK_RATES["boj"]) * 0.14

        dxy_implied = intercept + slope * spread_2y_w
        residual    = dxy_actual - dxy_implied

        return {
            "residual":    round(float(residual), 3),
            "dxy_implied": round(float(dxy_implied), 3),
            "alpha":       round(float(intercept), 4),
            "beta":        round(float(slope), 4),
        }

    except Exception as e:
        print(f"  [residual] ERROR: {e}")
        dxy_actual = yahoo_data.get("dxy", 103.0)
        return {
            "residual":    0.0,
            "dxy_implied": round(dxy_actual, 3),
            "alpha":       0.0,
            "beta":        1.0,
        }


# ─── Public entry point ───────────────────────────────────────────────────────

def fetch_all() -> dict:
    print("[fetch_data] FRED...")
    fred = fetch_fred()
    print("[fetch_data] Yahoo Finance...")
    yahoo = fetch_yahoo()
    print("[fetch_data] DXY residual...")
    residual = compute_dxy_residual(fred, yahoo)

    return {
        "fred":     fred,
        "yahoo":    yahoo,
        "residual": residual,
        "central_bank_rates": CENTRAL_BANK_RATES,
        "fetched_at": datetime.utcnow().isoformat() + "Z",
    }
