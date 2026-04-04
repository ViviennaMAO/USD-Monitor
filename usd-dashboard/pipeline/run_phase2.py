"""
USD Monitor Phase 2 — Orchestrator
Fetch → Features → Train (if needed) → Inference → Backtest

Usage:
    python run_phase2.py              # Full pipeline
    python run_phase2.py --retrain    # Force model retrain
    python run_phase2.py --diag       # Include IC diagnostics (slow)
"""
import sys
import time
from pathlib import Path

# Ensure pipeline directory is on path
sys.path.insert(0, str(Path(__file__).parent))

from config_v2 import MODEL_PATH, OUTPUT_DIR


def main():
    retrain = "--retrain" in sys.argv
    run_diag = "--diag" in sys.argv

    t0 = time.time()
    print("=" * 60)
    print("  USD Monitor Phase 2 Pipeline")
    print("=" * 60)

    # ── Step 1: Fetch Data ────────────────────────────────────────────────
    print("\n[1/5] Fetching historical data...")
    from fetch_features import fetch_all_history
    raw = fetch_all_history()
    print(f"  Raw data: {len(raw)} rows, {raw.index.min()} to {raw.index.max()}")

    # ── Step 2: Build Features ────────────────────────────────────────────
    print("\n[2/5] Building features...")
    from features import build_features
    features = build_features(raw)

    # ── Step 3: Train Model (if needed) ───────────────────────────────────
    if retrain or not MODEL_PATH.exists():
        print("\n[3/5] Training model...")
        from train import train_model
        model = train_model(features)
    else:
        print(f"\n[3/5] Model exists at {MODEL_PATH}, skipping training.")
        print("  (use --retrain to force)")

    # ── Step 4: Daily Inference ───────────────────────────────────────────
    print("\n[4/5] Running inference...")
    from inference import run_inference
    summary = run_inference(features)

    # ── Step 5: Backtest ──────────────────────────────────────────────────
    print("\n[5/5] Running backtest...")
    from backtest import run_backtest
    bt_result = run_backtest(features)

    # ── Optional: IC Diagnostics ──────────────────────────────────────────
    if run_diag:
        print("\n[bonus] Running IC diagnostics...")
        from ic_diagnostic import run_diagnostics
        run_diagnostics(features)

    # ── Summary ───────────────────────────────────────────────────────────
    elapsed = time.time() - t0
    print("\n" + "=" * 60)
    print("  Pipeline Complete")
    print("=" * 60)
    print(f"  Time: {elapsed:.1f}s")
    print(f"  Output: {OUTPUT_DIR}")
    print(f"  Signal: {summary.get('signal_grade', 'N/A')} ({summary.get('prediction', 0):+.4f}%)")
    if bt_result and "total_return" in bt_result:
        print(f"  Backtest: {bt_result['total_return']:+.2f}% return, "
              f"Sharpe={bt_result['sharpe']:.2f}, "
              f"MaxDD={bt_result['max_drawdown']:.2%}")

    # List output files
    print(f"\n  Output files:")
    for f in sorted(OUTPUT_DIR.glob("*.json")):
        size_kb = f.stat().st_size / 1024
        print(f"    {f.name} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
