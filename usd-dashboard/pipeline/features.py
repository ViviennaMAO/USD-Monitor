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


# ── Orthogonalization Utility ─────────────────────────────────────────────

def _orthogonalize_rolling(y: pd.Series, x: pd.Series, window: int = 252) -> pd.Series:
    """
    Rolling OLS residual: y_orth = y - β×x.
    Used to remove VIX contamination from BBB credit spread (F8).
    """
    result = pd.Series(np.nan, index=y.index)
    valid = y.notna() & x.notna()
    y_clean = y[valid]
    x_clean = x[valid]

    for i in range(window, len(y_clean)):
        y_win = y_clean.iloc[i - window:i]
        x_win = x_clean.iloc[i - window:i]
        if len(y_win) < 40:
            continue
        x_mean = x_win.mean()
        y_mean = y_win.mean()
        cov = ((x_win - x_mean) * (y_win - y_mean)).sum()
        var = ((x_win - x_mean) ** 2).sum()
        if var == 0:
            result.loc[y_clean.index[i]] = y_clean.iloc[i]
        else:
            beta = cov / var
            alpha = y_mean - beta * x_mean
            result.loc[y_clean.index[i]] = y_clean.iloc[i] - (alpha + beta * x_clean.iloc[i])
    return result


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

    # F2: Real Rate Delta (TIPS 10Y 20d change — fixes Real Rate Illusion bias)
    # v1 used level Z(DFII10) which had regime-dependent sign flips
    # v2 uses change: captures direction of real rate movement, not level
    real_rate_delta = df["DFII10"].diff(20)
    out["F2_RealRateDelta"] = rolling_zscore(real_rate_delta)

    # F3: Term Spread (10Y - 2Y yield curve slope)
    term_spread = df["DGS10"] - df["DGS2"]
    out["F3_TermSpread"] = rolling_zscore(term_spread)

    # F4: VIX (risk sentiment)
    out["F4_VIX"] = rolling_zscore(df["VIX_close"])

    # F5: Breakeven Inflation (10Y)
    out["F5_BEI"] = rolling_zscore(df["T10YIE"])

    # ── Reformed Factors (post-bias-audit) ────────────────────────────
    # F6: Yield Curve Momentum — 20d change in term spread
    # Replaces F6_RatePath (ICIR=-1.91, collinear with F1)
    # Captures flattening/steepening dynamics — genuine regime transition signal
    yc_momentum = term_spread.diff(20)
    out["F6_YCMomentum"] = rolling_zscore(yc_momentum)

    # F7: Long Yield Delta (10Y yield 20d change)
    # Replaces F7_DXYMomentum (ICIR=-2.16, target leakage: 20d mom ↔ 20d target)
    # ρ=0.87 with F2 is acceptable: both real and nominal rate momentum are predictive,
    # and XGBoost handles correlated features well via conditional splits.
    # Tested alternatives: RateVol(MOVE) ρ=0.93 vs F9, InflationMom worse OOS IC.
    long_yield_delta = df["DGS10"].diff(20)
    out["F7_LongYieldDelta"] = rolling_zscore(long_yield_delta)

    # F8: Credit Residual — BBB OAS orthogonalized against VIX
    # Replaces raw F8_CreditSpread (ρ=0.583 with F4_VIX → double-counting)
    # credit_residual = BBB_OAS − β×VIX (rolling 252d OLS)
    bbb = df["BAMLC0A4CBBB"]
    vix = df["VIX_close"]
    credit_resid = _orthogonalize_rolling(bbb, vix, window=252)
    out["F8_CreditResidual"] = rolling_zscore(credit_resid)

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
