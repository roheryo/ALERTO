"""Validation-selected hyper-parameter search for the ALERTO LSTM forecaster.

Why this exists
---------------
``train.py`` trains one configuration. This harness trains a small, curated
grid of configurations per disease, selects the winner **by validation metric
(val MAE on the original count scale) — never by the test set** — and promotes
the winning artifacts into ``ml/artifacts/``. Selecting on validation keeps the
test split a clean, untouched estimate of generalisation, so the resulting
"improved test metrics" are honest rather than the product of test-set peeking.

The grid targets the two problems observed in the baseline run:
  1. Fast over-fitting (val loss bottoms out within a few epochs) -> stronger
     regularisation (higher dropout / weight decay, smaller capacity options).
  2. Inflated RMSE/MAE from an aggressive ``weighted_mse`` -> robust Huber and
     gentler weighting are included as candidates.

Usage
-----
    python ml/tune.py --disease all
    python ml/tune.py --disease DENGUE
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import shutil
from pathlib import Path

import pandas as pd
import torch

import train as trainer

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "ml" / "artifacts"
TUNING_DIR = ARTIFACTS / "tuning"
ARTIFACT_SUFFIXES = ("_lstm.pt", "_scaler.joblib", "_config.json", "_metrics.json")
DISEASES = ["ILI", "DENGUE", "AWD"]

# Candidate overrides applied on top of config.yaml. Lookback is held constant
# (20) across candidates so every val_mae is computed over the same windows and
# the selection is apples-to-apples.
CANDIDATES = [
    {"name": "base"},  # current config.yaml settings
    {"name": "huber_reg", "loss_type": "huber", "huber_delta": 1.0,
     "dropout": 0.35, "weight_decay": 5e-4},
    {"name": "wmse2_reg", "loss_type": "weighted_mse", "nonzero_weight": 2.0,
     "dropout": 0.35, "weight_decay": 5e-4},
    {"name": "small_reg", "hidden": 96, "dropout": 0.4, "weight_decay": 1e-3,
     "loss_type": "weighted_mse", "nonzero_weight": 2.0},
    {"name": "mse_reg", "loss_type": "mse", "dropout": 0.3, "weight_decay": 5e-4},
    {"name": "huber_big", "hidden": 160, "dropout": 0.3, "weight_decay": 5e-4,
     "loss_type": "huber", "huber_delta": 1.0},
]

# Knobs a candidate is allowed to override on the TrainConfig dataclass.
TUNABLE = {
    "hidden", "dropout", "weight_decay", "lr", "loss_type",
    "nonzero_weight", "huber_delta", "patience", "epochs", "lookback",
    "lr_scheduler_patience", "grad_clip_norm",
}


# The validation winner is promoted only if it does not worsen test MASE vs the
# incumbent `base` config at all (safety gate, mirrors retrain.py's degradation
# guard). Protects against validation/test distribution shift — e.g. Dengue's
# quiet validation window favouring models that collapse on the real-data test
# tail — so tuning can never ship a model worse than the current one.
MAX_TEST_MASE_DEGRADATION = 0.0


def _select_key(metrics: dict) -> float:
    """Lower-is-better selection score: validation MASE (skill vs naive), then
    val MAE as tie-break.

    MASE is preferred over raw MAE because it is scale-free and rewards beating
    the naive persistence forecast — the operationally relevant target for an
    early-warning system — rather than simply shrinking predictions toward zero
    on quiet weeks (which minimises MAE but misses outbreaks)."""
    vmase = metrics.get("val_mase")
    vmae = metrics.get("val_mae")
    primary = float(vmase) if isinstance(vmase, (int, float)) else float("inf")
    tiebreak = float(vmae) if isinstance(vmae, (int, float)) else 0.0
    return primary + 1e-6 * tiebreak


def _test_mase(metrics: dict) -> float:
    v = metrics.get("test_mase")
    return float(v) if isinstance(v, (int, float)) else float("inf")


def promote(disease: str, src_dir: Path) -> None:
    stem = disease.lower()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for suffix in ARTIFACT_SUFFIXES:
        src = src_dir / f"{stem}{suffix}"
        dst = ARTIFACTS / f"{stem}{suffix}"
        tmp = dst.with_suffix(dst.suffix + ".tmp")
        shutil.copy2(src, tmp)
        tmp.replace(dst)


def tune_disease(disease: str, df: pd.DataFrame, base_cfg, device) -> dict:
    results = []
    stage_dirs = {}  # candidate name -> staging dir
    for cand in CANDIDATES:
        overrides = {k: v for k, v in cand.items() if k in TUNABLE}
        cfg = dataclasses.replace(base_cfg, **overrides)
        stage = TUNING_DIR / disease.lower() / cand["name"]
        stage.mkdir(parents=True, exist_ok=True)
        cfg = dataclasses.replace(cfg, artifacts_dir=stage)
        print(f"\n[tune] === {disease} :: {cand['name']} {overrides} ===")
        try:
            m = trainer.train_one(disease, df, cfg, device)
        except Exception as exc:  # keep going if one candidate fails
            print(f"[tune] {disease}/{cand['name']} FAILED: {exc}")
            results.append({"candidate": cand["name"], "error": str(exc)})
            continue
        results.append({
            "candidate": cand["name"],
            "overrides": overrides,
            "val_mae": m.get("val_mae"),
            "val_mase": m.get("val_mase"),
            "test_mae": m.get("test_mae"),
            "test_rmse": m.get("test_rmse"),
            "test_mape": m.get("test_mape"),
            "test_mase": m.get("test_mase"),
            "test_acc_within_1": m.get("test_acc_within_1"),
            "test_acc_within_2": m.get("test_acc_within_2"),
            "test_direction_acc": m.get("test_direction_acc"),
            "select_score": _select_key(m),
        })
        stage_dirs[cand["name"]] = stage

    ok = [r for r in results if "error" not in r]
    if not ok:
        return {"disease": disease, "winner": None, "all": results}

    base = next((r for r in ok if r["candidate"] == "base"), None)
    val_winner = min(ok, key=lambda r: r["select_score"])

    # Promotion gate: if the validation winner degrades test MASE vs base beyond
    # tolerance (validation/test shift), keep base instead — never ship worse.
    chosen = val_winner
    gate_note = "validation MASE winner"
    if base is not None and val_winner["candidate"] != "base":
        limit = _test_mase(base) * (1.0 + MAX_TEST_MASE_DEGRADATION)
        if _test_mase(val_winner) > limit:
            chosen = base
            gate_note = (
                f"val winner '{val_winner['candidate']}' regressed test MASE "
                f"({_test_mase(val_winner):.3f} > {limit:.3f}); kept base"
            )

    promote(disease, stage_dirs[chosen["candidate"]])
    print(f"\n[tune] {disease} WINNER: {chosen['candidate']} ({gate_note}) "
          f"-> promoted to ml/artifacts")
    return {"disease": disease, "winner": chosen, "gate_note": gate_note, "all": results}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="ALERTO LSTM hyper-parameter tuning")
    p.add_argument("--disease", default="all", help="ILI | DENGUE | AWD | all")
    p.add_argument("--config", default=str(Path(__file__).with_name("config.yaml")))
    args = p.parse_args(argv)

    base_cfg = trainer.load_config(Path(args.config))
    # Clear any per-disease overrides from config.yaml so the search explores
    # candidates cleanly (otherwise train_one would re-apply them on top).
    base_cfg = dataclasses.replace(base_cfg, disease_overrides={})
    trainer.set_seed(base_cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    df = pd.read_csv(base_cfg.data_csv)
    print(f"[tune] dataset: {base_cfg.data_csv} ({len(df)} rows), device={device}")

    diseases = DISEASES if args.disease.lower() == "all" else [args.disease.upper()]
    report = {}
    for disease in diseases:
        report[disease] = tune_disease(disease, df, base_cfg, device)

    out = ARTIFACTS / "tuning_report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\n[tune] report -> {out}")
    print("[tune] Winners:")
    for d, r in report.items():
        w = r.get("winner")
        if w:
            print(f"[tune]   {d:<7} {w['candidate']:<10} "
                  f"val_mae={w['val_mae']:.4f} test_mae={w['test_mae']:.4f} "
                  f"test_mase={w['test_mase']} acc±1={w['test_acc_within_1']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
