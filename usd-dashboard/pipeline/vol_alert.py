"""
σ_alert 12-factor volatility alert engine.
"""
import numpy as np
from config import SCORE_RANGES


def _norm(val: float, lo: float, hi: float) -> float:
    return float(max(0.0, min(1.0, (val - lo) / (hi - lo))))


def _zscore(val: float, series: list, window: int = 252) -> float:
    arr = np.array(series[-window:], dtype=float)
    arr = arr[~np.isnan(arr)]
    if len(arr) < 5:
        return 0.0
    return float((val - arr.mean()) / (arr.std() + 1e-9))


def _percentile(val: float, series: list) -> float:
    arr = np.array([x for x in series if not np.isnan(x)])
    if len(arr) == 0:
        return 50.0
    return float(np.sum(arr <= val) / len(arr) * 100)


def score_sigma_alert(data: dict) -> dict:
    yahoo    = data["yahoo"]
    fred     = data["fred"]
    residual = data["residual"]

    # ── Raw inputs ────────────────────────────────────────────────────────────
    vix          = yahoo.get("vix",   20.0)
    vvix         = yahoo.get("vvix", 100.0)
    vxn          = yahoo.get("vxn",   22.0)
    ovx          = yahoo.get("ovx",   50.0)
    gvz          = yahoo.get("gvz",   20.0)
    gvz_prev     = yahoo.get("gvz_prev", gvz * 1.05)
    vxhyg        = yahoo.get("vxhyg", 12.0)
    vxhyg_prev   = yahoo.get("vxhyg_prev", vxhyg * 1.05)
    qqq_ret      = yahoo.get("qqq_ret", 0.0)
    spy_ret      = yahoo.get("spy_ret", 0.0)
    tips_1y      = fred.get("tips10y", 1.85)    # use TIPS 10Y as proxy for 1Y real rate
    ovx_52w      = yahoo.get("ovx_52w_series", [ovx])
    rr_25d       = residual.get("residual", 0.0)  # Use DXY residual as RR proxy
    dxy_residual = residual.get("residual", 0.0)

    # Build approximate RR from residual (no Bloomberg in free tier)
    # RR proxy: scaled DXY residual, range roughly [-1, +1]
    rr_proxy = np.clip(dxy_residual / 2.5, -1.5, 1.5)

    # z-scores (use available series or approximate)
    rr_history   = [rr_proxy * (0.8 + 0.4 * np.random.rand()) for _ in range(252)]   # synthetic history
    res_history  = [abs(dxy_residual) * (0.5 + np.random.rand()) for _ in range(252)]

    rr_zscore  = _zscore(rr_proxy, rr_history)
    res_zscore = _zscore(abs(dxy_residual), res_history)
    rr_pct     = _percentile(rr_proxy, rr_history)

    # ── F1: 3M 25D Risk Reversal (proxy) ─────────────────────────────────────
    f1 = _norm(abs(rr_zscore), 0, 2.5) * 100
    f1_dir = "push" if abs(rr_zscore) > 0.6 else "neutral"

    # ── F2: FX-Rate Spread Residual ───────────────────────────────────────────
    f2 = _norm(abs(res_zscore), 0, 2.5) * 100
    f2_dir = "push" if abs(res_zscore) > 0.5 else "neutral"

    # ── F3: OVX ──────────────────────────────────────────────────────────────
    ovx_pct = _percentile(ovx, ovx_52w)
    f3 = _norm(ovx, *SCORE_RANGES["ovx"]) * 100
    f3_dir = "push" if ovx_pct > 70 else ("suppress" if ovx_pct < 30 else "neutral")

    # ── F4: VVIX/VIX ─────────────────────────────────────────────────────────
    vvix_vix = vvix / max(vix, 1.0)
    f4 = _norm(vvix_vix, *SCORE_RANGES["vvix_vix"]) * 100
    f4_dir = "push" if vvix_vix > 4.5 else "neutral"

    # ── F5: VXN-VIX gap ──────────────────────────────────────────────────────
    gap = vxn - vix
    f5 = _norm(gap, *SCORE_RANGES["vxn_vix_gap"]) * 100
    f5_dir = "latent_push" if gap > 2 else "neutral"
    f5_trigger = vxn > 30

    # ── F6: VXHYG (suppressor) ───────────────────────────────────────────────
    vxhyg_chg = (vxhyg - vxhyg_prev) / max(vxhyg_prev, 0.1) * 100
    f6 = (1 - _norm(vxhyg, *SCORE_RANGES["vxhyg"])) * 100
    f6_dir = "suppress" if vxhyg_chg < -15 else "neutral"

    # ── F7: GVZ (suppressor) ─────────────────────────────────────────────────
    gvz_chg = (gvz - gvz_prev) / max(gvz_prev, 0.1) * 100
    f7 = (1 - _norm(gvz, *SCORE_RANGES["gvz"])) * 100
    f7_dir = "suppress" if gvz_chg < -5 else "neutral"

    # ── F8: RR × Residual resonance ──────────────────────────────────────────
    comp_z = rr_zscore + res_zscore
    is_res = (rr_zscore > 0.5 and res_zscore > 0.5) or (rr_zscore < -0.5 and res_zscore < -0.5)
    f8 = _norm(abs(comp_z), 0, 3.0) * 100
    if is_res:
        f8 = min(100, f8 * 1.2)
    f8_dir = "push" if abs(comp_z) > 1.0 else "neutral"

    # ── F9: OVX × TIPS stagflation ────────────────────────────────────────────
    stagflation = _norm(ovx, 50, 150) * _norm(tips_1y, *SCORE_RANGES["tips_1y"])
    f9 = min(100, stagflation * 100)
    f9_dir = "push" if ovx > 80 and tips_1y > 3 else "neutral"

    # ── F10: VVIX/VIX × RR ───────────────────────────────────────────────────
    tail_dir = vvix_vix * abs(rr_proxy)
    f10 = _norm(tail_dir, *SCORE_RANGES["tail_dir"]) * 100
    f10_dir = "push" if tail_dir > 4.0 else ("latent_push" if tail_dir > 2.5 else "neutral")

    # ── F11: VXN-VIX × QQQ/SPY divergence ────────────────────────────────────
    spillover = gap * abs(qqq_ret - spy_ret) / max(abs(spy_ret), 0.01) if spy_ret != 0 else 0
    f11 = _norm(spillover, *SCORE_RANGES["spillover"]) * 100
    f11_dir = "latent_push" if f5_trigger else "neutral"

    # ── F12: VXHYG × CDS credit repair ───────────────────────────────────────
    # Use BBB spread as CDS proxy
    cds_ig = fred.get("bbb_spread", 60.0) * 100  # convert % to bps if needed
    if cds_ig < 5:   # likely in % format, convert
        cds_ig *= 100
    credit_calm = _norm(-vxhyg_chg, 0, 30) * (1 - _norm(cds_ig, 40, 120))
    f12 = min(100, credit_calm * 100)
    f12_dir = "suppress" if vxhyg_chg < -15 and cds_ig < 80 else "neutral"

    # ── Layer weights ─────────────────────────────────────────────────────────
    direct_score    = 0.50 * f1 + 0.50 * f2
    cross_asset     = 0.30 * f3 + 0.25 * f4 + 0.20 * f5 + 0.15 * f6 + 0.10 * f7
    composite_score = 0.30 * f8 + 0.25 * f9 + 0.20 * f10 + 0.15 * f11 + 0.10 * f12

    suppress_dirs = [f6_dir, f7_dir, f12_dir]
    suppress_n    = sum(1 for d in suppress_dirs if d == "suppress")
    suppress_pen  = suppress_n * 5

    sigma = 0.30 * direct_score + 0.35 * cross_asset + 0.35 * composite_score
    sigma = round(float(np.clip(sigma - suppress_pen, 0, 100)), 1)

    push_dirs = [f1_dir, f2_dir, f3_dir, f4_dir, f5_dir, f8_dir, f9_dir, f10_dir, f11_dir]
    push_n    = sum(1 for d in push_dirs if d in ("push", "latent_push"))

    if sigma >= 75 and push_n >= 5:
        alert_level = "alert"
    elif sigma >= 60:
        alert_level = "warning"
    elif sigma >= 40:
        alert_level = "watch"
    else:
        alert_level = "calm"

    net_dir = "expansion" if push_n > suppress_n else "compression"

    return {
        "score":        sigma,
        "alert_level":  alert_level,
        "push_count":   push_n,
        "suppress_count": suppress_n,
        "net_direction": net_dir,
        "summary": (
            f"推升因子({push_n}个，含{'RR极端、' if abs(rr_zscore)>1 else ''}{'OVX高位、' if ovx>80 else ''}{'VVIX/VIX偏高' if vvix_vix>4.5 else ''})"
            f"{'超过' if push_n > suppress_n else '未超过'}压制因子({suppress_n}个)，"
            f"整体偏向波动率{'扩张' if net_dir == 'expansion' else '收缩'}方向。"
        ),
        "f1_rr": {
            "value": round(rr_proxy, 3), "zscore": round(rr_zscore, 2),
            "percentile": round(rr_pct, 1), "score": round(f1, 1), "direction": f1_dir,
        },
        "f2_residual": {
            "value": round(dxy_residual, 3), "zscore": round(res_zscore, 2),
            "score": round(f2, 1), "direction": f2_dir,
        },
        "f3_ovx": {
            "value": round(ovx, 2), "percentile": round(ovx_pct, 1),
            "score": round(f3, 1), "direction": f3_dir,
        },
        "f4_vvix_vix": {
            "vvix": round(vvix, 2), "vix": round(vix, 2), "value": round(vvix_vix, 2),
            "score": round(f4, 1), "direction": f4_dir,
        },
        "f5_vxn_vix": {
            "vix": round(vix, 2), "vxn": round(vxn, 2), "gap": round(gap, 2),
            "trigger": f5_trigger, "score": round(f5, 1), "direction": f5_dir,
        },
        "f6_vxhyg": {
            "value": round(vxhyg, 2), "change_pct": round(vxhyg_chg, 2),
            "score": round(f6, 1), "direction": f6_dir,
        },
        "f7_gvz": {
            "value": round(gvz, 2), "change_pct": round(gvz_chg, 2),
            "score": round(f7, 1), "direction": f7_dir,
        },
        "f8_rr_residual": {
            "composite_z": round(comp_z, 2), "is_resonance": is_res,
            "score": round(f8, 1), "direction": f8_dir,
        },
        "f9_stagflation": {
            "ovx": round(ovx, 2), "tips": round(tips_1y, 2),
            "score": round(f9, 1), "direction": f9_dir,
        },
        "f10_tail_directional": {
            "value": round(tail_dir, 2),
            "score": round(f10, 1), "direction": f10_dir,
        },
        "f11_tech_spillover": {
            "gap": round(gap, 2), "spillover": round(spillover, 2),
            "trigger": f5_trigger, "score": round(f11, 1), "direction": f11_dir,
        },
        "f12_credit_repair": {
            "vxhyg_chg": round(vxhyg_chg, 2), "cds": round(cds_ig, 1),
            "score": round(f12, 1), "direction": f12_dir,
        },
        # For trend chart
        "rr_zscore": round(rr_zscore, 3),
    }
