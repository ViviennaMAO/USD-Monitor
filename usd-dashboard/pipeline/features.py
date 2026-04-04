"""
USD Monitor Phase 2 — Factor Engineering
Computes 10 Z-score-normalized factors from raw historical data.
Pattern identical to GoldMonitor's features.py.
"""
import numpy as np
import pandas as pd

from config_v2 import (
    FACTOR_COLS, ZSCORE_WINDOW, ZSCORE_CLIP, FORWARD_DAYS,
)


# ── Core Utility ───────────────────────────────────────────────────────────

def rolling_zscore(series: pd.Series, window: int = ZSCORE_WINDOW) -> pd.Series:
    """
    Rolling Z-score with safeguards.
    - 252-day rolling window (1 year)
    - min_periods=20 allows early computation
    - Clips to [-5, 5] to prevent outlier dominance
    """
    mean = series.rolling(window, min_periods=20).mean()
    std = series.rolling(window, min_periods=20).std()
    z = (series - mean) / std.replace(0, np.nan)
    z = z.replace([np.inf, -np.inf], np.nan).clip(-ZSCORE_CLIP, ZSCORE_CLIP)
    return z


def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series,
                period: int = 14) -> pd.Series:
    """
    Average True Range. Falls back to absolute daily change
    if OHLC data is unreliable.
    """
    if high is None or low is None or high.isnull().all() or low.isnull().all():
        # Fallback: use absolute daily change scaled by sqrt(2/pi)
        daily_change = close.diff().abs()
        return daily_change.rolling(period, min_periods=5).mean() * np.sqrt(np.pi / 2)

    prev_close = close.shift(1)
    tr = pd.concat([
        (high - low),
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(period, min_periods=5).mean()


def kaufman_efficiency(series: pd.Series, period: int = 14) -> pd.Series:
    """Kaufman Efficiency Ratio: directional move / total path length."""
    direction = (series - series.shift(period)).abs()
    volatility = series.diff().abs().rolling(period, min_periods=5).sum()
    return (direction / volatility.replace(0, np.nan)).clip(0, 1)


# ── Factor Construction ───────────────────────────────────────────────────

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build 10 Z-score factors + auxiliary regime features + target.

    Input: raw DataFrame from fetch_features.fetch_all_history()
    Output: DataFrame with factor columns, regime aux columns, target, and price columns
    """
    out = pd.DataFrame(index=df.index)

    # ── Base Factors (5) ───────────────────────────────────────────────
    # F1: Rate Differential (Fed - ECB)
    rate_diff = df["FEDFUNDS"] - df["ECB_RATE"]
    out["F1_RateDiff"] = rolling_zscore(rate_diff)

    # F2: Real Rate (TIPS 10Y)
    out["F2_RealRate"] = rolling_zscore(df["DFII10"])

    # F3: Term Spread (10Y - 2Y yield curve slope)
    term_spread = df["DGS10"] - df["DGS2"]
    out["F3_TermSpread"] = rolling_zscore(term_spread)

    # F4: VIX (risk sentiment)
    out["F4_VIX"] = rolling_zscore(df["VIX_close"])

    # F5: Breakeven Inflation (10Y)
    out["F5_BEI"] = rolling_zscore(df["T10YIE"])

    # ── Logical Factors (5) ────────────────────────────────────────────
    # F6: Rate Path — market expectations vs current policy
    rate_path = df["DGS2"] - df["FEDFUNDS"]
    out["F6_RatePath"] = rolling_zscore(rate_path)

    # F7: DXY Momentum — 20-day percent change
    dxy_mom = df["DXY_close"].pct_change(20) * 100
    out["F7_DXYMomentum"] = rolling_zscore(dxy_mom)

    # F8: Credit Spread — BBB OAS
    out["F8_CreditSpread"] = rolling_zscore(df["BAMLC0A4CBBB"])

    # F9: Vol Spread — VIX minus MOVE (equity vs bond vol divergence)
    if "MOVE_close" in df.columns and not df["MOVE_close"].isnull().all():
        vol_spread = df["VIX_close"] - df["MOVE_close"]
        out["F9_VolSpread"] = rolling_zscore(vol_spread)
    else:
        out["F9_VolSpread"] = 0.0

    # F10: Funding Stress — SOFR - IORB (in bps)
    funding = (df["SOFR"] - df["IORB"]) * 100
    out["F10_FundingStress"] = rolling_zscore(funding)

    # ── Auxiliary Features (for regime detection, not in model) ─────────
    out["yield_curve_raw"] = term_spread
    out["yield_curve_z"] = rolling_zscore(term_spread)
    out["yield_curve_mom_z"] = rolling_zscore(term_spread.diff(20))
    out["bei_momentum_20d"] = df["T10YIE"].diff(20)
    out["raw_DGS2"] = df["DGS2"]
    out["raw_FEDFUNDS"] = df["FEDFUNDS"]

    # DXY efficiency ratio (for Dollar Smile / rate shock attribution)
    out["dxy_efficiency"] = kaufman_efficiency(df["DXY_close"], period=14)

    # DXY ATR ratio (5d/20d — trending vs consolidating)
    dxy_daily = df["DXY_close"].diff().abs()
    atr_5 = dxy_daily.rolling(5, min_periods=3).mean()
    atr_20 = dxy_daily.rolling(20, min_periods=10).mean()
    out["dxy_atr_ratio"] = (atr_5 / atr_20.replace(0, np.nan)).clip(0, 3)

    # VIX momentum (for Layer 3)
    out["vix_momentum_z"] = rolling_zscore(df["VIX_close"].pct_change(10) * 100)

    # ── Target Variable ────────────────────────────────────────────────
    out["target"] = (
        df["DXY_close"].shift(-FORWARD_DAYS) / df["DXY_close"] - 1
    ) * 100

    # ── Price Columns (for backtest) ───────────────────────────────────
    out["dxy_price"] = df["DXY_close"]
    out["dxy_high"] = df.get("DXY_high")
    out["dxy_low"] = df.get("DXY_low")
    out["dxy_open"] = df.get("DXY_open")

    # ATR for position sizing
    out["atr"] = compute_atr(
        df.get("DXY_high"), df.get("DXY_low"), df["DXY_close"]
    )

    # ── Data Quality ───────────────────────────────────────────────────
    # Fill remaining NaN factors with 0 (conservative neutral)
    for col in FACTOR_COLS:
        if col in out.columns:
            out[col] = out[col].fillna(0.0)

    print(f"[features] Built {len(FACTOR_COLS)} factors, {len(out)} rows")
    print(f"[features] Factor coverage:")
    for col in FACTOR_COLS:
        non_zero = (out[col] != 0).sum()
        print(f"  {col}: {non_zero} non-zero ({non_zero/len(out)*100:.0f}%)")

    return out


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    raw = fetch_all_history()
    features = build_features(raw)
    print("\n=== Feature Summary ===")
    print(features[FACTOR_COLS].describe())
    print(f"\nTarget coverage: {features['target'].notna().sum()} rows")
    print(f"Z-score range check (should be [-5, 5]):")
    for col in FACTOR_COLS:
        print(f"  {col}: [{features[col].min():.2f}, {features[col].max():.2f}]")
