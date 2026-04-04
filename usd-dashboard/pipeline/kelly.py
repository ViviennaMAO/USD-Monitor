"""
USD Monitor Phase 2 — Kelly Criterion Position Sizing
Wilson lower-bound win rate, 1/4 Kelly, Phase 1→2 transition at 50 trades.
"""
import numpy as np
from scipy.stats import norm

from config_v2 import (
    KELLY_PHASE1_RISK, KELLY_PHASE1_N, KELLY_FRACTION,
    KELLY_MIN_RISK, KELLY_MAX_RISK, SIGNAL_GRADE_MULT,
    RISK_BUDGET, ATR_STOP_MULT,
)


def wilson_lower_bound(wins: int, total: int, z: float = 1.645) -> float:
    """
    Wilson score interval lower bound for win rate.
    Conservative estimate — avoids overconfidence with small samples.
    z=1.645 → 95% one-sided confidence.
    """
    if total == 0:
        return 0.5
    p_hat = wins / total
    denom = 1 + z**2 / total
    center = p_hat + z**2 / (2 * total)
    spread = z * np.sqrt((p_hat * (1 - p_hat) + z**2 / (4 * total)) / total)
    return (center - spread) / denom


def kelly_fraction_calc(win_rate: float, avg_win: float, avg_loss: float) -> float:
    """
    Kelly criterion: f* = (p * b - q) / b
    where p = win rate, q = 1-p, b = avg_win / avg_loss.
    Returns 1/4 Kelly, clipped to [MIN_RISK, MAX_RISK].
    """
    if avg_loss == 0 or avg_win == 0:
        return KELLY_MIN_RISK

    b = abs(avg_win / avg_loss)
    q = 1 - win_rate
    f_star = (win_rate * b - q) / b

    # 1/4 Kelly for safety
    f_quarter = f_star * KELLY_FRACTION
    return float(np.clip(f_quarter, KELLY_MIN_RISK, KELLY_MAX_RISK))


def compute_kelly_risk(trade_history: list, signal_grade: str = "Neutral") -> dict:
    """
    Compute position risk budget using Kelly criterion.

    Phase 1 (< 50 trades): Fixed 1% risk per trade
    Phase 2 (≥ 50 trades): Full Kelly with Wilson lower-bound win rate

    Args:
        trade_history: List of dicts with 'pnl_pct' key
        signal_grade: Current signal grade for multiplier

    Returns:
        Dict with risk_pct, kelly_f, win_rate, phase, etc.
    """
    n_trades = len(trade_history)
    grade_mult = SIGNAL_GRADE_MULT.get(signal_grade, 0.0)

    # Phase 1: fixed risk
    if n_trades < KELLY_PHASE1_N:
        risk_pct = KELLY_PHASE1_RISK * grade_mult
        return {
            "phase": 1,
            "n_trades": n_trades,
            "risk_pct": round(risk_pct, 4),
            "kelly_f": 0.0,
            "win_rate": 0.0,
            "win_rate_wilson": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "signal_grade": signal_grade,
            "grade_mult": grade_mult,
        }

    # Phase 2: Kelly
    pnls = [t["pnl_pct"] for t in trade_history]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    n_wins = len(wins)
    raw_wr = n_wins / n_trades if n_trades > 0 else 0.5
    wilson_wr = wilson_lower_bound(n_wins, n_trades)

    avg_win = np.mean(wins) if wins else 0.0
    avg_loss = abs(np.mean(losses)) if losses else 0.0

    kelly_f = kelly_fraction_calc(wilson_wr, avg_win, avg_loss)
    risk_pct = kelly_f * grade_mult

    return {
        "phase": 2,
        "n_trades": n_trades,
        "risk_pct": round(float(risk_pct), 4),
        "kelly_f": round(float(kelly_f), 4),
        "win_rate": round(float(raw_wr), 4),
        "win_rate_wilson": round(float(wilson_wr), 4),
        "avg_win": round(float(avg_win), 4),
        "avg_loss": round(float(avg_loss), 4),
        "signal_grade": signal_grade,
        "grade_mult": grade_mult,
    }


def position_size(equity: float, atr: float, risk_pct: float) -> dict:
    """
    ATR-based position sizing.
    Units = (equity × risk_pct) / (ATR × stop_mult)
    """
    if atr <= 0 or risk_pct <= 0:
        return {"units": 0.0, "stop_distance": 0.0, "risk_amount": 0.0}

    stop_distance = atr * ATR_STOP_MULT
    risk_amount = equity * risk_pct
    units = risk_amount / stop_distance

    return {
        "units": round(float(units), 2),
        "stop_distance": round(float(stop_distance), 4),
        "risk_amount": round(float(risk_amount), 2),
    }


if __name__ == "__main__":
    # Demo
    fake_trades = [{"pnl_pct": np.random.normal(0.3, 1.5)} for _ in range(80)]
    result = compute_kelly_risk(fake_trades, signal_grade="Buy")
    print("=== Kelly Sizing ===")
    for k, v in result.items():
        print(f"  {k}: {v}")

    pos = position_size(100_000, 0.5, result["risk_pct"])
    print("\n=== Position Size ===")
    for k, v in pos.items():
        print(f"  {k}: {v}")
