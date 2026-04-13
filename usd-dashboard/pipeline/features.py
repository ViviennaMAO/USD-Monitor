"""
USD Monitor Phase 2 — Factor Engineering
Computes 10 Z-score-normalized factors from raw historical data.
Pattern identical to GoldMonitor's features.py.
"""
import numpy as np
import pandas as pd

from config_v2 import (
    FACTOR_COLS, SIGMA_FACTOR_COLS, ALL_FACTOR_COLS,
    ZSCORE_WINDOW, ZSCORE_CLIP, FORWARD_DAYS,
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


# ── σ_alert Factor Construction ──────────────────────────────────────
# Ported from TypeScript lib/scoring.ts → scoreSigmaAlert()
# These 12 volatility-based factors were previously display-only.
# Now they participate in ML training alongside the 10 fundamental factors.

def _norm(val: pd.Series, lo: float, hi: float) -> pd.Series:
    """Normalize series to [0, 1] given a fixed range."""
    return ((val - lo) / (hi - lo)).clip(0, 1)


def _rolling_percentile(series: pd.Series, window: int = 252) -> pd.Series:
    """Rolling percentile rank (0-100)."""
    return series.rolling(window, min_periods=20).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
    )


def _compute_dxy_residual(df: pd.DataFrame) -> pd.Series:
    """
    DXY residual = DXY - β × DGS2 (rolling OLS).
    Measures how much DXY deviates from what interest rate differentials imply.
    Port of TypeScript computeDxyResidual().
    """
    dxy = df.get("DXY_close")
    dgs2 = df.get("DGS2")
    if dxy is None or dgs2 is None:
        return pd.Series(0.0, index=df.index)

    residual = _orthogonalize_rolling(dxy, dgs2, window=252)
    return residual.fillna(0.0)


def _realized_vol(close: pd.Series, window: int = 21) -> pd.Series:
    """Annualized realized volatility from daily returns."""
    ret = close.pct_change()
    return ret.rolling(window, min_periods=10).std() * np.sqrt(252) * 100


def _build_sigma_factors(df: pd.DataFrame, out: pd.DataFrame) -> pd.DataFrame:
    """
    Build 12 σ_alert factors from market data.
    All factors are Z-score normalized to match the F-series convention.
    """
    # ── Prerequisites ─────────────────────────────────────────────────
    dxy_resid = _compute_dxy_residual(df)

    # Safely get optional series (may be missing if Yahoo data unavailable)
    vvix = df.get("VVIX_close", pd.Series(np.nan, index=df.index))
    vxn = df.get("VXN_close", pd.Series(np.nan, index=df.index))
    ovx = df.get("OVX_close", pd.Series(np.nan, index=df.index))
    gvz = df.get("GVZ_close", pd.Series(np.nan, index=df.index))
    hyg = df.get("HYG_close", pd.Series(np.nan, index=df.index))
    qqq = df.get("QQQ_close", pd.Series(np.nan, index=df.index))
    spy = df.get("SPY_close", pd.Series(np.nan, index=df.index))
    vix = df.get("VIX_close", pd.Series(np.nan, index=df.index))
    tips = df.get("DFII10", pd.Series(np.nan, index=df.index))
    bbb = df.get("BAMLC0A4CBBB", pd.Series(np.nan, index=df.index))

    # ── Layer 1: Direct USD Volatility (σ1, σ2) ──────────────────────

    # σ1: Risk Reversal proxy — DXY residual z-score (directional)
    rr_proxy = dxy_resid / 2.5  # scale similar to real RR
    out["σ1_RiskReversal"] = rolling_zscore(rr_proxy)

    # σ2: FX Rate-Spread Residual — absolute value (magnitude of dislocation)
    out["σ2_FxRateResidual"] = rolling_zscore(dxy_resid.abs())

    # ── Layer 2: Cross-Asset Volatility (σ3-σ7) ──────────────────────

    # σ3: OVX Oil Volatility — normalized scale
    out["σ3_OVX"] = rolling_zscore(ovx)

    # σ4: VVIX/VIX Ratio — vol-of-vol premium
    vvix_vix = vvix / vix.replace(0, np.nan)
    out["σ4_VVIX_VIX"] = rolling_zscore(vvix_vix)

    # σ5: VXN-VIX Gap — tech vs broad equity vol divergence
    vxn_vix_gap = vxn - vix
    out["σ5_VXN_VIX"] = rolling_zscore(vxn_vix_gap)

    # σ6: VXHYG proxy — HYG realized volatility (21d annualized)
    hyg_rv = _realized_vol(hyg, window=21)
    out["σ6_VXHYG"] = rolling_zscore(hyg_rv)

    # σ7: GVZ Gold Volatility
    out["σ7_GVZ"] = rolling_zscore(gvz)

    # ── Layer 3: Composite Cross-Signals (σ8-σ12) ────────────────────

    # σ8: RR × Residual Resonance — when both directional signals align
    rr_z = rolling_zscore(rr_proxy)
    res_z = rolling_zscore(dxy_resid)
    # Resonance: product of z-scores (positive when both agree)
    resonance = rr_z * res_z
    out["σ8_RR_Residual"] = rolling_zscore(resonance)

    # σ9: OVX × TIPS Stagflation — oil vol rising + real rates (stagflation signal)
    ovx_norm = _norm(ovx, 20, 80)
    tips_norm = _norm(tips.abs(), 0, 3)
    stagflation_raw = ovx_norm * tips_norm
    out["σ9_Stagflation"] = rolling_zscore(stagflation_raw)

    # σ10: VVIX/VIX × RR Tail Risk — tail directionality
    tail_raw = vvix_vix * rr_proxy.abs()
    out["σ10_TailRisk"] = rolling_zscore(tail_raw)

    # σ11: Tech Spillover — VXN-VIX gap × QQQ/SPY return divergence
    qqq_ret = qqq.pct_change()
    spy_ret = spy.pct_change()
    equity_div = (qqq_ret - spy_ret).abs() / spy_ret.abs().replace(0, np.nan)
    tech_spill = vxn_vix_gap * equity_div.clip(0, 5)
    out["σ11_TechSpillover"] = rolling_zscore(tech_spill)

    # σ12: Credit Repair — VXHYG change × inverse CDS pressure
    hyg_rv_chg = hyg_rv.pct_change(5)  # 5-day % change in realized vol
    bbb_norm = _norm(bbb, 1.0, 5.0)  # BBB spread normalized
    credit_repair = -hyg_rv_chg * (1 - bbb_norm)  # Falling HY vol + low spreads = repair
    out["σ12_CreditRepair"] = rolling_zscore(credit_repair)

    return out


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

    # ── σ_alert Factors (12 volatility factors, v3 merge) ──────────────
    # Ported from TypeScript scoring.ts → Python for ML training
    out = _build_sigma_factors(df, out)

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
    for col in ALL_FACTOR_COLS:
        if col in out.columns:
            out[col] = out[col].fillna(0.0)

    print(f"[features] Built {len(ALL_FACTOR_COLS)} factors ({len(FACTOR_COLS)} fundamental + {len(SIGMA_FACTOR_COLS)} σ_alert), {len(out)} rows")
    print(f"[features] Factor coverage:")
    for col in ALL_FACTOR_COLS:
        if col in out.columns:
            non_zero = (out[col] != 0).sum()
            print(f"  {col}: {non_zero} non-zero ({non_zero/len(out)*100:.0f}%)")

    return out


if __name__ == "__main__":
    from fetch_features import fetch_all_history
    raw = fetch_all_history()
    features = build_features(raw)
    print("\n=== Feature Summary ===")
    avail = [c for c in ALL_FACTOR_COLS if c in features.columns]
    print(features[avail].describe())
    print(f"\nTarget coverage: {features['target'].notna().sum()} rows")
    print(f"Z-score range check (should be [-5, 5]):")
    for col in avail:
        print(f"  {col}: [{features[col].min():.2f}, {features[col].max():.2f}]")
