"""
USD Monitor Phase 2 — Circuit Breaker
Drawdown-based risk reduction + IC-based signal hibernation.
"""
import numpy as np
import pandas as pd

from config_v2 import (
    DRAWDOWN_REDUCE_HALF, DRAWDOWN_PAUSE, DRAWDOWN_PAUSE_DAYS,
    DRAWDOWN_LIQUIDATE, IC_HIBERNATE, IC_FULL_SIGNAL, IC_WINDOW,
)


class CircuitBreaker:
    """
    Three-tier drawdown circuit breaker + IC hibernation.

    Drawdown tiers:
      >5%  → halve position size
      >8%  → pause trading for 20 days
      >15% → liquidate all positions

    IC hibernation:
      Rolling 60d IC < 0.05 → suppress signals (model unreliable)
      IC between 0.05-0.15 → scale signal linearly
      IC >= 0.15 → full signal
    """

    def __init__(self):
        self.pause_until = None
        self.liquidated = False
        self.peak_nav = 1.0

    def update(self, nav: float, current_date: pd.Timestamp = None) -> dict:
        """
        Update circuit breaker state with current NAV.

        Returns:
            Dict with status, position_mult, drawdown, etc.
        """
        # Track peak
        if nav > self.peak_nav:
            self.peak_nav = nav

        drawdown = (self.peak_nav - nav) / self.peak_nav if self.peak_nav > 0 else 0.0

        # Check pause expiry
        if self.pause_until is not None and current_date is not None:
            if current_date >= self.pause_until:
                self.pause_until = None
                self.liquidated = False
                self.peak_nav = nav  # Reset peak after pause

        # Drawdown tiers
        if drawdown >= DRAWDOWN_LIQUIDATE:
            self.liquidated = True
            return {
                "status": "liquidated",
                "position_mult": 0.0,
                "drawdown": round(drawdown, 4),
                "message": f"Drawdown {drawdown:.1%} ≥ {DRAWDOWN_LIQUIDATE:.0%} → LIQUIDATE",
            }

        if drawdown >= DRAWDOWN_PAUSE:
            if self.pause_until is None and current_date is not None:
                self.pause_until = current_date + pd.Timedelta(days=DRAWDOWN_PAUSE_DAYS)
            return {
                "status": "paused",
                "position_mult": 0.0,
                "drawdown": round(drawdown, 4),
                "pause_until": self.pause_until.strftime("%Y-%m-%d") if self.pause_until else None,
                "message": f"Drawdown {drawdown:.1%} ≥ {DRAWDOWN_PAUSE:.0%} → PAUSE {DRAWDOWN_PAUSE_DAYS}d",
            }

        if drawdown >= DRAWDOWN_REDUCE_HALF:
            return {
                "status": "reduced",
                "position_mult": 0.5,
                "drawdown": round(drawdown, 4),
                "message": f"Drawdown {drawdown:.1%} ≥ {DRAWDOWN_REDUCE_HALF:.0%} → HALVE position",
            }

        if self.liquidated:
            return {
                "status": "recovering",
                "position_mult": 0.0,
                "drawdown": round(drawdown, 4),
                "message": "Post-liquidation recovery period",
            }

        return {
            "status": "normal",
            "position_mult": 1.0,
            "drawdown": round(drawdown, 4),
            "message": "Normal operation",
        }

    def reset(self):
        """Reset circuit breaker state."""
        self.pause_until = None
        self.liquidated = False
        self.peak_nav = 1.0


def ic_signal_scale(rolling_ic: float) -> float:
    """
    Scale signal strength based on rolling IC.
    IC < 0.05 → 0 (hibernate)
    IC 0.05-0.15 → linear scale 0-1
    IC >= 0.15 → 1.0 (full signal)
    """
    if rolling_ic < IC_HIBERNATE:
        return 0.0
    if rolling_ic >= IC_FULL_SIGNAL:
        return 1.0
    # Linear interpolation
    return (rolling_ic - IC_HIBERNATE) / (IC_FULL_SIGNAL - IC_HIBERNATE)


def compute_rolling_ic(predictions: np.ndarray, actuals: np.ndarray,
                       window: int = IC_WINDOW) -> float:
    """Compute rolling Spearman IC over recent window."""
    from scipy.stats import spearmanr

    n = min(window, len(predictions))
    if n < 20:
        return 0.0

    ic, _ = spearmanr(predictions[-n:], actuals[-n:])
    return float(ic) if not np.isnan(ic) else 0.0


if __name__ == "__main__":
    cb = CircuitBreaker()

    # Simulate drawdown sequence
    navs = [1.0, 0.98, 0.96, 0.94, 0.92, 0.90, 0.88, 0.86]
    for i, nav in enumerate(navs):
        date = pd.Timestamp("2025-01-01") + pd.Timedelta(days=i)
        state = cb.update(nav, date)
        print(f"Day {i}: NAV={nav:.2f}, {state['status']} (mult={state['position_mult']})")

    print("\n=== IC Signal Scale ===")
    for ic in [0.0, 0.03, 0.05, 0.10, 0.15, 0.25]:
        print(f"  IC={ic:.2f} → scale={ic_signal_scale(ic):.2f}")
