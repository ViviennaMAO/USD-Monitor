"""
Daily pipeline runner — fetches data, computes scores, outputs JSON.
Run: python run_daily.py
Requires: FRED_API_KEY in .env.local (project root) or environment.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

# Allow imports from pipeline/
sys.path.insert(0, str(Path(__file__).parent))

from config import OUTPUT_DIR, CENTRAL_BANK_RATES
from fetch_data import fetch_all
from scoring import score_rf, score_pi_risk, score_cy, compute_gamma
from vol_alert import score_sigma_alert


def _write(filename: str, data: dict):
    path = OUTPUT_DIR / filename
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"  ✓ {filename}")


def run():
    now = datetime.now(timezone.utc)
    data_date = now.strftime("%Y-%m-%d")
    data_time = "16:00 ET Close"

    print(f"\n{'='*50}")
    print(f"USDMonitor Pipeline — {data_date}")
    print(f"{'='*50}\n")

    # ── 1. Fetch all raw data ─────────────────────────────────────────────────
    print("[1/6] Fetching data...")
    data = fetch_all()
    yahoo = data["yahoo"]
    fred  = data["fred"]

    # ── 2. Score components ───────────────────────────────────────────────────
    print("[2/6] Scoring r_f...")
    rf = score_rf(data)

    print("[3/6] Scoring π_risk...")
    pi = score_pi_risk(data)

    print("[4/6] Scoring cy...")
    cy = score_cy(data)

    print("[5/6] Scoring σ_alert (13 factors)...")
    sigma = score_sigma_alert(data)
    rr_z  = sigma.get("rr_zscore", 0.0)

    print("[6/6] Computing γ...")
    gamma_data = compute_gamma(rf, pi, cy, sigma, rr_z)

    # ── 3. Build output JSONs ─────────────────────────────────────────────────
    print("\nWriting output JSONs...")

    # score.json
    _write("score.json", {
        "gamma":         gamma_data["gamma"],
        "signal":        gamma_data["signal"],
        "rf_score":      gamma_data["rf_score"],
        "pi_risk_score": gamma_data["pi_risk_score"],
        "cy_score":      gamma_data["cy_score"],
        "sigma_score":   gamma_data["sigma_score"],
        "data_date":     data_date,
        "data_time":     data_time,
    })

    # components.json
    _write("components.json", {
        "rf":      rf,
        "pi_risk": pi,
        "cy":      cy,
    })

    # vol_alert.json
    sigma_out = {k: v for k, v in sigma.items() if k != "rr_zscore"}
    _write("vol_alert.json", sigma_out)

    # dxy.json
    dxy_price  = yahoo.get("dxy", 103.0)
    dxy_prev   = yahoo["dxy_history"][-2]["price"] if len(yahoo.get("dxy_history", [])) >= 2 else dxy_price
    change_1d  = round(dxy_price - dxy_prev, 3)
    change_pct = round(change_1d / dxy_prev * 100, 3) if dxy_prev else 0
    _write("dxy.json", {
        "price":         round(dxy_price, 3),
        "change_1d":     change_1d,
        "change_1d_pct": change_pct,
        "high_52w":      round(max(d["price"] for d in yahoo.get("dxy_history", [{"price": dxy_price}])), 2),
        "low_52w":       round(min(d["price"] for d in yahoo.get("dxy_history", [{"price": dxy_price}])), 2),
        "real_rate":     round(fred.get("tips10y", 1.85), 2),
        "sofr":          round(fred.get("sofr", 5.31), 2),
        "history":       yahoo.get("dxy_history", []),
    })

    # fx_pairs.json
    def _signal(chg): return "BULLISH" if chg > 0.3 else "BEARISH" if chg < -0.3 else "NEUTRAL"
    eurusd = yahoo.get("eurusd", 1.08)
    usdjpy = yahoo.get("usdjpy", 150.0)
    usdcny = yahoo.get("usdcny", 7.23)
    usdmxn = yahoo.get("usdmxn", 20.0)

    def _pct_chg(sym_key, hist_key="fx_trend"):
        # rough 1d change from fx_trend if available
        trend = yahoo.get("fx_trend", [])
        if len(trend) >= 2:
            if sym_key == "eurusd" and trend[-1].get("eurusd") and trend[-2].get("eurusd"):
                return round((trend[-1]["eurusd"] - trend[-2]["eurusd"]) / trend[-2]["eurusd"] * 100, 2)
            if sym_key == "usdjpy" and trend[-1].get("usdjpy") and trend[-2].get("usdjpy"):
                return round((trend[-1]["usdjpy"] - trend[-2]["usdjpy"]) / trend[-2]["usdjpy"] * 100, 2)
            if sym_key == "dxy" and trend[-1].get("dxy") and trend[-2].get("dxy"):
                return round((trend[-1]["dxy"] - trend[-2]["dxy"]) / trend[-2]["dxy"] * 100, 2)
        return 0.0

    dxy_chg  = _pct_chg("dxy")
    eur_chg  = _pct_chg("eurusd")
    jpy_chg  = _pct_chg("usdjpy")

    _write("fx_pairs.json", {
        "pairs": [
            {"symbol": "DXY",    "label": "DXY Index",  "price": round(dxy_price, 2), "change_pct": dxy_chg,  "signal": _signal(dxy_chg)},
            {"symbol": "EURUSD", "label": "EUR/USD",    "price": round(eurusd, 4),    "change_pct": eur_chg,  "signal": _signal(eur_chg)},
            {"symbol": "USDJPY", "label": "USD/JPY",    "price": round(usdjpy, 2),    "change_pct": jpy_chg,  "signal": _signal(jpy_chg)},
            {"symbol": "USDCNY", "label": "USD/CNY",    "price": round(usdcny, 4),    "change_pct": 0.0,      "signal": "NEUTRAL"},
            {"symbol": "USDMXN", "label": "USD/MXN",    "price": round(usdmxn, 2),    "change_pct": 0.0,      "signal": "NEUTRAL"},
        ],
        "trend": yahoo.get("fx_trend", []),
    })

    # yield_decomp.json
    dgs10  = fred.get("dgs10", 4.28)
    tips10 = fred.get("tips10y", 1.85)
    bei10  = fred.get("bei10y", 2.33)
    bei5      = fred.get("bei5y", 2.48)
    fwd5y5y   = fred.get("fwd5y5y", 2.20)
    tp_approx = round((dgs10 - fred.get("dgs2", 4.62)) * 100, 1)

    drivers = {"real_rate": tips10, "inflation": bei10, "term_premium": max(0, tp_approx / 100)}
    driver  = max(drivers, key=drivers.get)

    _write("yield_decomp.json", {
        "nominal_10y":  round(dgs10, 2),
        "real_rate":    round(tips10, 2),
        "bei_10y":      round(bei10, 2),
        "term_premium": round(tp_approx / 100, 3),
        "driver":       driver,
        "bei_5y":       round(bei5, 2),
        "fwd5y5y":      round(fwd5y5y, 2),
        "note": (
            f"当前10Y收益率{dgs10:.2f}%由{'实际利率' if driver=='real_rate' else '通胀预期' if driver=='inflation' else '期限溢价'}主导。"
            f"BEI通胀预期{bei10:.2f}%，5Y5Y远期通胀锚定{fwd5y5y:.2f}%，期限溢价{tp_approx:+.0f}bps。"
        ),
    })

    # cftc.json — static for v1.0 (updated manually)
    _write("cftc.json", {
        "currencies": [
            {"label": "USD Index", "net": 28500, "prev": 24200, "history": [18000, 20500, 22000, 24200, 25800, 27100, 28500]},
            {"label": "EUR (反向)", "net": -15200, "prev": -12800, "history": [-8000, -10200, -11500, -12800, -13900, -14600, -15200]},
            {"label": "JPY (反向)", "net": -8700, "prev": -9200, "history": [-11000, -10500, -9800, -9200, -9000, -8900, -8700]},
            {"label": "GBP (反向)", "net": 4200, "prev": 3800, "history": [2000, 2800, 3200, 3800, 4000, 4100, 4200]},
            {"label": "CAD", "net": -6100, "prev": -5500, "history": [-3500, -4200, -4800, -5500, -5800, -6000, -6100]},
        ],
        "note": "CFTC数据每周更新(周五发布)，v1.0使用近期实际数据。",
    })

    # hedge.json
    sofr = fred.get("sofr", 5.31)
    estr = CENTRAL_BANK_RATES["estr"]
    _write("hedge.json", {
        "score":                62,
        "cip_basis":            -18.5,
        "eur_long":             12.4,
        "jpy_long":             -8.2,
        "dxy_rate_divergence":  round(data["residual"].get("residual", 1.2), 2),
        "sofr":                 round(sofr, 2),
        "estr":                 estr,
        "note": "对冲传导效率中等。CIP基差轻度偏负，反映美元短端融资压力。资管机构EUR持有多头，JPY净空头维持。",
    })

    # signal_history.json — append today's entry
    hist_path = OUTPUT_DIR / "signal_history.json"
    if hist_path.exists():
        history = json.loads(hist_path.read_text())
    else:
        history = []

    # Deduplicate by date
    history = [h for h in history if h.get("date") != data_date]
    prev    = history[-1] if history else None
    if prev:
        prev_signal = prev.get("signal", gamma_data["signal"])
        order = {"BULLISH": 2, "NEUTRAL": 1, "BEARISH": 0}
        change = (
            "↑" if order.get(gamma_data["signal"], 1) > order.get(prev_signal, 1) else
            "↓" if order.get(gamma_data["signal"], 1) < order.get(prev_signal, 1) else
            "↔"
        )
    else:
        change = "↔"

    history.append({
        "date":   data_date,
        "signal": gamma_data["signal"],
        "score":  gamma_data["gamma"],
        "change": change,
        "note": (
            f"γ={gamma_data['gamma']:.0f}：r_f={rf['score']:.0f} / π={pi['score']:.0f} / cy={cy['score']:.0f} / σ={sigma['score']:.0f}。"
            f" DXY={round(dxy_price, 2)}, VIX={round(yahoo.get('vix',20), 1)}"
        ),
    })
    # Keep last 30 entries
    history = history[-30:]
    _write("signal_history.json", history)

    # macro_snapshot.json — raw values for Next.js APIs to avoid live-fetch
    # dependency on Vercel (Yahoo Finance blocks many Vercel IPs, FRED needs key)
    def _safe(v, default=None):
        try:
            import math
            if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
                return default
            return v
        except Exception:
            return default

    _write("macro_snapshot.json", {
        "date":        data_date,
        # Yahoo prices
        "dxy":         _safe(yahoo.get("dxy")),
        "gold":        _safe(yahoo.get("gold")),
        "spy":         _safe(yahoo.get("spy")),
        "qqq":         _safe(yahoo.get("qqq")),
        "vix":         _safe(yahoo.get("vix")),
        "vvix":        _safe(yahoo.get("vvix")),
        "vxn":         _safe(yahoo.get("vxn")),
        "ovx":         _safe(yahoo.get("ovx")),
        "gvz":         _safe(yahoo.get("gvz")),
        "hyg":         _safe(yahoo.get("hyg")),
        "eurusd":      _safe(yahoo.get("eurusd")),
        "usdjpy":      _safe(yahoo.get("usdjpy")),
        "spy_ret":     _safe(yahoo.get("spy_ret")),
        "qqq_ret":     _safe(yahoo.get("qqq_ret")),
        # FRED fundamentals
        "fedfunds":    _safe(fred.get("fedfunds")),
        "dgs2":        _safe(fred.get("dgs2")),
        "dgs10":       _safe(fred.get("dgs10")),
        "tips10y":     _safe(fred.get("tips10y")),
        "bei10y":      _safe(fred.get("bei10y")),
        "bei5y":       _safe(fred.get("bei5y")),
        "fwd5y5y":     _safe(fred.get("fwd5y5y")),
        "sofr":        _safe(fred.get("sofr")),
        "iorb":        _safe(fred.get("iorb")),
        "bbb_spread":  _safe(fred.get("bbb_spread")),
        "wage_growth": _safe(fred.get("wage_growth")),
        "debt_gdp":    _safe(fred.get("debt_gdp")),
        # Derived
        "residual":    _safe(data.get("residual", {}).get("residual")),
    })

    print(f"\n✅ Pipeline complete — γ={gamma_data['gamma']} ({gamma_data['signal']})")
    print(f"   r_f={rf['score']} | π_risk={pi['score']} | cy={cy['score']} | σ_alert={sigma['score']}\n")


if __name__ == "__main__":
    run()
