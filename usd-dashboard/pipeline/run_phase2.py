"""
USD Monitor Phase 2 — Orchestrator
Fetch → Features → Train → Inference → Backtest → Calibrate → Orthogonalize → Route

Usage:
    python run_phase2.py                # Full pipeline
    python run_phase2.py --retrain      # Force model retrain
    python run_phase2.py --recalibrate  # Force Bayesian weight recalibration
    python run_phase2.py --diag         # Include IC diagnostics (slow)
"""
import sys
import time
import json as _json
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
    print("\n[1/8] Fetching historical data...")
    from fetch_features import fetch_all_history
    raw = fetch_all_history()
    print(f"  Raw data: {len(raw)} rows, {raw.index.min()} to {raw.index.max()}")

    # ── Step 2: Build Features ────────────────────────────────────────────
    print("\n[2/8] Building features...")
    from features import build_features
    features = build_features(raw)

    # ── Step 3: Train Model (if needed) ───────────────────────────────────
    if retrain or not MODEL_PATH.exists():
        print("\n[3/8] Training model...")
        from train import train_model
        model = train_model(features)
    else:
        print(f"\n[3/8] Model exists at {MODEL_PATH}, skipping training.")
        print("  (use --retrain to force)")

    # ── Step 4: Daily Inference ───────────────────────────────────────────
    print("\n[4/8] Running inference...")
    from inference import run_inference
    summary = run_inference(features)

    # ── Step 5: Backtest ──────────────────────────────────────────────────
    print("\n[5/8] Running backtest...")
    from backtest import run_backtest
    bt_result = run_backtest(features)

    # ── Step 6: P1 Bayesian Calibration ─────────────────────────────────────
    print("\n[6/8] Running Bayesian calibration (P1)...")
    from bayesian_calibrator import calibrate_weights
    regime_mult = summary.get("regime", {}).get("multiplier", 1.0)
    calibration = calibrate_weights(
        features, regime_multiplier=regime_mult, force="--recalibrate" in sys.argv
    )

    # ── Step 7: P1 OLS Orthogonalization ──────────────────────────────────
    print("\n[7/8] Running OLS orthogonalization (P1)...")
    from orthogonalizer import run_orthogonalization

    # Read γ score from Phase 1 output (score.json)
    gamma_score = 50.0
    gamma_components = {"rf": 50, "pi_risk": 50, "cy": 50, "sigma": 50}
    try:
        score_path = OUTPUT_DIR / "score.json"
        if score_path.exists():
            with open(score_path) as _f:
                score_data = _json.load(_f)
            gamma_score = float(score_data.get("gamma", 50))
            gamma_components = {
                "rf": int(score_data.get("rf_score", 50)),
                "pi_risk": int(score_data.get("pi_risk_score", 50)),
                "cy": int(score_data.get("cy_score", 50)),
                "sigma": int(score_data.get("sigma_score", 50)),
            }
            print(f"  γ from Phase 1: {gamma_score:.0f} ({score_data.get('signal', 'N/A')})")
        else:
            print("  ⚠ score.json not found, using default γ=50")
    except Exception as e:
        print(f"  ⚠ Failed to read score.json: {e}, using default γ=50")

    ml_pred = summary.get("prediction", 0.0)

    # Note: In production, gamma_history and ml_history would come from
    # a persistent store of daily γ + ML predictions. For now, we run
    # orthogonalization with whatever history is available.
    ortho_result = run_orthogonalization(
        ml_pred=ml_pred,
        gamma_score=gamma_score,
        gamma_history=None,  # TODO: persist daily γ history
        ml_history=None,     # TODO: persist daily ML history
    )

    # ── Step 8: Unified Signal Router ─────────────────────────────────────
    print("\n[8/8] Running unified signal router...")
    from signal_router import route_signal

    # Read SHAP factors from inference output
    shap_factors = []
    try:
        shap_path = OUTPUT_DIR / "shap.json"
        if shap_path.exists():
            with open(shap_path) as _f:
                shap_data = _json.load(_f)
            shap_factors = shap_data.get("factors", [])
    except Exception:
        pass

    # Read VIX Z-score from features
    vix_z = 0.0
    try:
        if "F4_VIX" in features.columns:
            vix_z = float(features["F4_VIX"].iloc[-1])
    except Exception:
        pass

    # Route signal with P1 enrichments
    unified = route_signal(
        gamma_score=gamma_score,
        gamma_components=gamma_components,
        ml_pred=ml_pred,
        shap_factors=shap_factors,
        regime_result=summary.get("regime", {}),
        vix_z=vix_z,
        dxy_price=summary.get("dxy_price", 0.0),
        date=summary.get("date", ""),
        calibration=calibration,
        orthogonalization=ortho_result,
    )

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
    print(f"  ML Signal: {summary.get('signal_grade', 'N/A')} ({summary.get('prediction', 0):+.4f}%)")
    print(f"  γ Score: {gamma_score:.0f}")
    print(f"  Unified: {unified.get('action', 'N/A')} (source={unified.get('signal_source', 'N/A')}, "
          f"conflict={unified.get('conflict_score', 0):.2f})")
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
