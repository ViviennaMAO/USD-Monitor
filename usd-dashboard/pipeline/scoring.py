"""
Core scoring engine: r_f, π_risk, cy, and γ (综合评分).
"""
import numpy as np
from config import CENTRAL_BANK_RATES, SCORE_RANGES


def _norm(val: float, lo: float, hi: float) -> float:
    return float(max(0.0, min(1.0, (val - lo) / (hi - lo))))


def _zscore(val: float, series: list, window: int = 252) -> float:
    """Rolling z-score of val within the last `window` values of series."""
    arr = np.array(series[-window:], dtype=float)
    arr = arr[~np.isnan(arr)]
    if len(arr) < 5:
        return 0.0
    return float((val - arr.mean()) / (arr.std() + 1e-9))


# ─── r_f ─────────────────────────────────────────────────────────────────────

def score_rf(data: dict) -> dict:
    """
    Rate Differential Support score (0-100).
    Sub-factors: Fed-ECB spread, Fed-BOJ spread, Fed-BOE spread,
                 real rate (TIPS 10Y), rate path (2Y vs Fed Funds).
    """
    fred   = data["fred"]
    cb     = data["central_bank_rates"]

    fed    = fred.get("fedfunds", 4.50)
    dgs2   = fred.get("dgs2", 4.60)
    tips   = fred.get("tips10y", 1.85)

    ecb    = cb["ecb"]
    boj    = cb["boj"]
    boe    = cb["boe"]
    estr   = cb["estr"]
    sonia  = cb["sonia"]

    # DXY-weighted currency spreads
    spread_eur = fed - ecb          # 57% weight in DXY
    spread_jpy = fed - boj          # 14%
    spread_gbp = fed - boe          # 12%

    # Normalize each spread to [0,1] then to [0,100]
    # +3% spread → very bullish (score≈80), 0% → 50, negative → bearish
    def _spread_score(s): return _norm(s, -2.0, 4.0) * 100

    sf_eur  = _spread_score(spread_eur)
    sf_jpy  = _spread_score(spread_jpy)
    sf_gbp  = _spread_score(spread_gbp)

    # Real rate score: TIPS 10Y [-1, 3] → [0,100]
    sf_tips = _norm(tips, *SCORE_RANGES["tips10y"]) * 100

    # Rate path: 2Y vs Fed Funds (positive = market expects hike, hawkish)
    path = dgs2 - fed
    sf_path = _norm(path, *SCORE_RANGES["rate_path"]) * 100

    # Weighted composite
    score = (
        0.50 * (0.57 * sf_eur + 0.14 * sf_jpy + 0.12 * sf_gbp) / 0.83
        + 0.30 * sf_tips
        + 0.20 * sf_path
    )
    score = round(float(np.clip(score, 0, 100)), 1)

    signal = "USD 看多" if score >= 65 else "USD 看空" if score < 35 else "混合信号"

    return {
        "score": score,
        "signal": signal,
        "sub_factors": [
            {"label": "Fed vs ECB 利差",    "weight_label": "57%", "value": f"+{spread_eur:.2f}%", "score": round(sf_eur, 1),  "direction": "positive" if spread_eur > 0 else "negative"},
            {"label": "Fed vs BOJ 利差",    "weight_label": "14%", "value": f"+{spread_jpy:.2f}%", "score": round(sf_jpy, 1),  "direction": "positive" if spread_jpy > 0 else "negative"},
            {"label": "Fed vs BOE 利差",    "weight_label": "12%", "value": f"+{spread_gbp:.2f}%", "score": round(sf_gbp, 1),  "direction": "positive" if spread_gbp > 0 else "negative"},
            {"label": "实际利率 (10Y-BEI)", "weight_label": "10%", "value": f"{tips:.2f}%",        "score": round(sf_tips, 1), "direction": "positive" if tips > 0.5 else "neutral"},
            {"label": "利率路径 (2Y vs Fed)","weight_label": "7%", "value": "鹰派" if path > 0 else "鸽派", "score": round(sf_path, 1), "direction": "positive" if path > 0 else "negative"},
        ],
        "data_rows": [
            {"label": "Fed Funds",   "value": f"{fed:.2f}%"},
            {"label": "ECB Main",    "value": f"{ecb:.2f}%"},
            {"label": "BOJ Call",    "value": f"{boj:.2f}%"},
            {"label": "BOE Bank",    "value": f"{boe:.2f}%"},
            {"label": "€STR",        "value": f"{estr:.2f}%"},
            {"label": "SONIA",       "value": f"{sonia:.2f}%"},
            {"label": "2Y Treasury", "value": f"{dgs2:.2f}%"},
        ],
    }


# ─── π_risk ──────────────────────────────────────────────────────────────────

def score_pi_risk(data: dict) -> dict:
    """
    Risk Premium score (0-100).
    Classifies global risk (USD bullish) vs US-specific risk (USD bearish).
    """
    yahoo = data["yahoo"]
    fred  = data["fred"]

    vix  = yahoo.get("vix",  20.0)
    move = yahoo.get("move", 100.0)

    # Term premium approximation: 10Y - 2Y - expected short rate
    # ACM model not directly available; use 10Y - 2Y spread as proxy (bps)
    dgs10 = fred.get("dgs10", 4.28)
    dgs2  = fred.get("dgs2",  4.62)
    tp_approx = (dgs10 - dgs2) * 100   # bps (yield curve slope)

    # Determine risk type:
    # Global risk (flight to safety) → VIX↑ + TP↓ → USD bullish
    # US-specific risk (fiscal fear)  → VIX↑ + TP↑ → USD bearish
    risk_type = "us_specific" if (vix > 20 and tp_approx > 30) else "global_risk"

    vix_score  = _norm(vix, *SCORE_RANGES["vix"]) * 100
    move_score = _norm(move, 50.0, 200.0) * 100

    if risk_type == "global_risk":
        # VIX up = flight to safety = bullish USD
        tp_effect = (1.0 - _norm(max(0, tp_approx), 0, 300)) * 100
        score = 0.60 * vix_score + 0.25 * (100 - tp_effect) + 0.15 * move_score
    else:
        # US fiscal fear = bearish USD (invert VIX contribution)
        tp_effect = _norm(max(0, tp_approx), 0, 300) * 100
        score = 0.60 * (100 - vix_score) + 0.25 * (100 - tp_effect) + 0.15 * move_score

    score = round(float(np.clip(score, 0, 100)), 1)
    signal = "全球避险 · USD看多" if risk_type == "global_risk" else "美国风险 · USD看空" if vix > 25 else "混合信号"

    tp_pct = int(_norm(max(0, tp_approx), -100, 300) * 100)
    note = (
        f"VIX {vix:.1f} + TP {tp_approx:+.0f}bps → {('全球避险(Flight to Safety)' if risk_type == 'global_risk' else '财政恐惧(Fiscal Fear)')}。"
        f" 当前风险分类：{'✅ 全球风险 → USD看多' if risk_type == 'global_risk' else '⚠️ 美国特有风险 → USD看空'}。"
    )

    return {
        "score": score,
        "signal": signal,
        "risk_type": risk_type,
        "sub_factors": [
            {"label": "期限溢价 (10Y-2Y slope)", "weight_label": "40%", "value": f"{tp_approx:+.0f}bps", "score": round(tp_effect, 1), "direction": "neutral"},
            {"label": "VIX",  "weight_label": "35%", "value": f"{vix:.1f}",  "score": round(vix_score, 1),  "direction": "neutral"},
            {"label": "MOVE", "weight_label": "25%", "value": f"{move:.0f}", "score": round(move_score, 1), "direction": "neutral"},
        ],
        "data_rows": [
            {"label": "10Y TP (slope approx)", "value": f"{tp_approx:+.0f}bps"},
            {"label": "10Y Treasury",           "value": f"{dgs10:.2f}%"},
            {"label": "2Y Treasury",            "value": f"{dgs2:.2f}%"},
            {"label": "VIX",                    "value": f"{vix:.1f}"},
            {"label": "MOVE",                   "value": f"{move:.0f}"},
            {"label": "TP 分位数",              "value": f"{tp_pct}%ile"},
        ],
        "note": note,
    }


# ─── cy ──────────────────────────────────────────────────────────────────────

def score_cy(data: dict) -> dict:
    """
    Convenience Yield score (0-100, higher = more drag on USD).
    Sub-factors: gold 30d trend, SOFR-IORB spread, DXY residual.
    """
    yahoo    = data["yahoo"]
    fred     = data["fred"]
    residual = data["residual"]

    gold         = yahoo.get("gold", 3000.0)
    gold_trend   = yahoo.get("gold_trend_30d", 0.0)
    sofr         = fred.get("sofr", 5.31)
    iorb         = fred.get("iorb", 5.33)
    sofr_iorb_bp = (sofr - iorb) * 100       # bps
    dxy_residual = residual.get("residual", 0.0)
    dxy_implied  = residual.get("dxy_implied", 103.0)

    # Gold: rising gold = USD drag (higher cy score = more drag)
    gold_drag = _norm(gold_trend, *SCORE_RANGES["gold_trend30d"]) * 100

    # SOFR-IORB: negative = funding stress (drag on USD)
    funding_h = _norm(sofr_iorb_bp, *SCORE_RANGES["sofr_iorb"]) * 100

    # DXY residual: positive = overvalued vs rates (drag)
    res_score = _norm(dxy_residual, *SCORE_RANGES["dxy_residual"]) * 100

    score = round(float(np.clip(
        0.50 * gold_drag + 0.25 * (100 - funding_h) + 0.25 * (100 - res_score),
        0, 100
    )), 1)

    signal = "USD 轻度拖累" if score >= 55 else "USD 中性" if score >= 40 else "cy 支撑美元"
    direction_gold = "negative" if gold_trend > 2 else "positive" if gold_trend < -2 else "neutral"

    note = (
        f"黄金{'强势上行' if gold_trend > 3 else '温和上涨' if gold_trend > 0 else '回落'}({gold_trend:+.1f}% 30日)"
        f"{'反映去美元化资金流，对DXY形成结构性拖累。' if gold_trend > 3 else '，cy影响温和。'}"
        f" SOFR-IORB {sofr_iorb_bp:+.0f}bps，资金市场{'轻微压力' if sofr_iorb_bp < -5 else '基本健康'}。"
        f" DXY残差{'+偏贵' if dxy_residual > 0.5 else '-偏便宜' if dxy_residual < -0.5 else '中性'}({dxy_residual:+.2f}pts)。"
    )

    return {
        "score": score,
        "signal": signal,
        "sub_factors": [
            {"label": "黄金走势 (30d)",   "weight_label": "50%", "value": f"{gold_trend:+.1f}%", "score": round(gold_drag, 1), "direction": direction_gold},
            {"label": "SOFR-IORB 利差",   "weight_label": "25%", "value": f"{sofr_iorb_bp:+.0f}bps", "score": round(100 - funding_h, 1), "direction": "neutral"},
            {"label": "DXY 残差溢价",     "weight_label": "25%", "value": f"{dxy_residual:+.2f}pts", "score": round(100 - res_score, 1), "direction": "negative" if dxy_residual > 0.5 else "neutral"},
        ],
        "data_rows": [
            {"label": "黄金价格",        "value": f"${gold:,.0f}"},
            {"label": "黄金 30d 趋势",   "value": f"{gold_trend:+.1f}%"},
            {"label": "SOFR",            "value": f"{sofr:.2f}%"},
            {"label": "IORB",            "value": f"{iorb:.2f}%"},
            {"label": "SOFR-IORB",       "value": f"{sofr_iorb_bp:+.0f}bps"},
            {"label": "DXY 利率隐含值", "value": f"{dxy_implied:.2f}"},
            {"label": "DXY 超额溢价",   "value": f"{dxy_residual:+.2f}pts"},
        ],
        "note": note,
    }


# ─── 综合评分 γ ──────────────────────────────────────────────────────────────

def compute_gamma(rf: dict, pi: dict, cy: dict, sigma: dict, rr_zscore: float = 0.0) -> dict:
    """
    γ = 0.35*r_f + 0.25*π_risk − 0.25*cy + sigma_contribution + 50
    sigma_contribution direction is modulated by RR sign.
    """
    rf_s  = rf["score"]
    pi_s  = pi["score"]
    cy_s  = cy["score"]
    sig_s = sigma["score"]

    push    = sigma.get("push_count", 0)
    suppress= sigma.get("suppress_count", 0)

    # σ_alert weight adjustment
    if push >= 5 and suppress <= 1:
        sigma_w = 0.20
    elif suppress >= 2 and push <= 3:
        sigma_w = 0.10
    else:
        sigma_w = 0.15

    # σ direction follows RR sign
    sigma_sign = 1.0 if rr_zscore >= 0 else -1.0
    sigma_contrib = sigma_w * sig_s * sigma_sign

    remaining = 1.0 - sigma_w
    raw = (
        (0.35 / (1 - sigma_w)) * remaining * rf_s
        + (0.25 / (1 - sigma_w)) * remaining * pi_s
        - (0.25 / (1 - sigma_w)) * remaining * cy_s
        + sigma_contrib * 100 / sig_s if sig_s > 0 else 0
    )

    # Simpler direct formula matching PRD
    raw = 0.35 * rf_s + 0.25 * pi_s - 0.25 * cy_s + sigma_w * sig_s * sigma_sign
    gamma = float(np.clip(raw + 15, 0, 100))   # +15 offset so 50=neutral
    gamma = round(gamma, 1)

    signal = "BULLISH" if gamma >= 65 else "BEARISH" if gamma < 35 else "NEUTRAL"

    return {
        "gamma":          gamma,
        "signal":         signal,
        "rf_score":       rf_s,
        "pi_risk_score":  pi_s,
        "cy_score":       cy_s,
        "sigma_score":    sig_s,
        "sigma_weight":   sigma_w,
    }
