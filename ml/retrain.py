"""Weekly automated retraining orchestrator for the ALERTO LSTM forecaster.

This wraps the existing training pipeline (``train.py`` + ``CaseLSTM``) with the
operational safety machinery required to retrain in production on a schedule:

Training-data policy
---------------------
* Trains ONLY on actual, recorded confirmed cases. The dataset is rebuilt by
  invoking ``backend/scripts/build-ml-datasets.mjs --exclude-synthetic`` so that
  statistically-generated ``SYN-%`` rows are dropped before every run.
* The build script always aggregates the cumulative total of all eligible
  recorded cases up to "now", so each weekly run sees the full updated dataset,
  not just the new week.
* The model's targets (``cases_t_plus_1..4``) are shifted *actual* counts — no
  model-predicted / forecasted value is ever fed back into training.

Versioning & safety
--------------------
* Each run trains into a versioned staging directory
  ``ml/artifacts/versions/model_YYYY-MM-DD[ -N ]/`` — the live ``ml/artifacts``
  bundle is never touched while training runs, so the forecasting service keeps
  serving the previous model uninterrupted.
* A newly trained disease model is promoted to the active bundle ONLY if it
  validates (artifacts present, finite metrics, trained on real samples) and is
  not materially worse than the currently-active model (MAPE degradation within
  ``--max-mape-degradation``). Otherwise the previous active model is kept
  (automatic fallback).
* Every run appends a structured entry to ``ml/artifacts/retrain_log.jsonl``
  (timestamp + dataset size + per-disease decision/metrics) and updates
  ``ml/artifacts/active_version.json`` for traceability.
* After promotion the live FastAPI service is asked to hot-reload its cache via
  ``POST /reload`` (best-effort, short timeout) so the swap is picked up without
  a restart.

Usage
-----
    python ml/retrain.py                       # all diseases, real cases only
    python ml/retrain.py --disease DENGUE
    python ml/retrain.py --skip-build          # reuse existing CSV
    python ml/retrain.py --allow-synthetic     # escape hatch (NOT for prod)
    python ml/retrain.py --max-mape-degradation 0.05
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import math
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))

# Windows consoles default to cp1252, which cannot encode the em-dashes / arrows
# used in our log messages. Force UTF-8 so retrain logs never crash on output.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:
        pass

import train as trainer  # noqa: E402  (train.py — reused, architecture preserved)

ARTIFACTS = ROOT / "ml" / "artifacts"
VERSIONS_DIR = ARTIFACTS / "versions"
RETRAIN_LOG = ARTIFACTS / "retrain_log.jsonl"
ACTIVE_VERSION_FILE = ARTIFACTS / "active_version.json"
BUILD_SCRIPT = ROOT / "backend" / "scripts" / "build-ml-datasets.mjs"

# Artifact files written per disease by train.train_one (stem = disease.lower()).
ARTIFACT_SUFFIXES = ("_lstm.pt", "_scaler.joblib", "_config.json", "_metrics.json")

DISEASES = ["ILI", "DENGUE", "AWD"]


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _resolve_version_tag(base_dir: Path) -> str:
    """model_YYYY-MM-DD, suffixed -2, -3 ... if a same-day dir already exists."""
    day = datetime.now().strftime("%Y-%m-%d")
    tag = f"model_{day}"
    if not (base_dir / tag).exists():
        return tag
    n = 2
    while (base_dir / f"{tag}-{n}").exists():
        n += 1
    return f"{tag}-{n}"


def _read_ml_service_url() -> str:
    """ML_SERVICE_URL from env, else backend/.env, else the project default."""
    import os

    env_url = os.environ.get("ML_SERVICE_URL")
    if env_url:
        return env_url.strip()
    dotenv = ROOT / "backend" / ".env"
    if dotenv.is_file():
        for line in dotenv.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ML_SERVICE_URL="):
                return line.split("=", 1)[1].strip()
    return "http://127.0.0.1:5050"


def _load_metrics(path: Path) -> Optional[dict]:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _is_finite_number(value) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value)


# --------------------------------------------------------------------------- #
# Dataset rebuild (real recorded cases only)
# --------------------------------------------------------------------------- #

def rebuild_dataset(exclude_synthetic: bool) -> None:
    """Rebuild surveillance_weekly_training.csv from MySQL via the node script.

    Passes --exclude-synthetic by default so the production model only ever
    trains on actual recorded cases.
    """
    node = shutil.which("node")
    if node is None:
        raise RuntimeError(
            "`node` not found on PATH — cannot rebuild the dataset. Install "
            "Node.js or re-run with --skip-build to reuse the existing CSV."
        )
    cmd = [node, str(BUILD_SCRIPT)]
    if exclude_synthetic:
        cmd.append("--exclude-synthetic")
    print(f"[retrain] Rebuilding dataset: {' '.join(cmd)}")
    # Inherit stdout/stderr so the build log is visible in the retrain log.
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode != 0:
        raise RuntimeError(
            f"Dataset rebuild failed (exit {result.returncode}). Aborting "
            "retrain so the active model is left untouched."
        )


# --------------------------------------------------------------------------- #
# Validation: is the freshly-trained model safe to promote?
# --------------------------------------------------------------------------- #

@dataclasses.dataclass
class Decision:
    disease: str
    status: str  # "promoted" | "fallback" | "failed"
    reason: str
    new_mape: Optional[float] = None
    active_mape: Optional[float] = None
    train_samples: Optional[int] = None
    test_samples: Optional[int] = None


def evaluate_candidate(
    disease: str,
    version_dir: Path,
    new_metrics: Optional[dict],
    max_degradation: float,
    force: bool,
) -> Decision:
    """Decide whether the staged model for `disease` may replace the active one."""
    stem = disease.lower()

    # 1. All artifact files must exist in the staging dir.
    for suffix in ARTIFACT_SUFFIXES:
        if not (version_dir / f"{stem}{suffix}").is_file():
            return Decision(disease, "failed", f"missing staged artifact {stem}{suffix}")

    if not new_metrics:
        return Decision(disease, "failed", "staged metrics.json unreadable")

    train_samples = new_metrics.get("train_samples")
    test_samples = new_metrics.get("test_samples")
    new_mape = new_metrics.get("test_mape")

    # 2. Must have actually trained on real samples.
    if not isinstance(train_samples, int) or train_samples <= 0:
        return Decision(
            disease, "failed", "no training samples (empty real-case dataset?)",
            train_samples=train_samples, test_samples=test_samples,
        )

    active_metrics = _load_metrics(ARTIFACTS / f"{stem}_metrics.json")
    active_mape = active_metrics.get("test_mape") if active_metrics else None

    # 3. Bootstrap case: no active model yet → promote whatever trained.
    if active_metrics is None:
        return Decision(
            disease, "promoted", "no active model — bootstrapping first version",
            new_mape=new_mape if _is_finite_number(new_mape) else None,
            active_mape=None, train_samples=train_samples, test_samples=test_samples,
        )

    # 4. Need a finite test MAPE to compare against the active baseline.
    if not _is_finite_number(new_mape):
        if force:
            return Decision(
                disease, "promoted", "no test split to validate, but --force set",
                new_mape=None, active_mape=active_mape,
                train_samples=train_samples, test_samples=test_samples,
            )
        return Decision(
            disease, "fallback",
            "candidate has no comparable test MAPE — keeping active model",
            new_mape=None, active_mape=active_mape,
            train_samples=train_samples, test_samples=test_samples,
        )

    # 5. Degradation gate: lower MAPE is better.
    if _is_finite_number(active_mape):
        threshold = active_mape * (1.0 + max_degradation)
        if new_mape <= threshold or force:
            reason = (
                f"MAPE {new_mape:.4f} within {max_degradation:.0%} of active "
                f"{active_mape:.4f}" + (" (forced)" if force and new_mape > threshold else "")
            )
            return Decision(
                disease, "promoted", reason,
                new_mape=new_mape, active_mape=active_mape,
                train_samples=train_samples, test_samples=test_samples,
            )
        return Decision(
            disease, "fallback",
            f"MAPE {new_mape:.4f} worse than active {active_mape:.4f} "
            f"beyond {max_degradation:.0%} tolerance — keeping active model",
            new_mape=new_mape, active_mape=active_mape,
            train_samples=train_samples, test_samples=test_samples,
        )

    # Active model has no comparable MAPE → promote the new measurable one.
    return Decision(
        disease, "promoted", "active model had no test MAPE — promoting candidate",
        new_mape=new_mape, active_mape=None,
        train_samples=train_samples, test_samples=test_samples,
    )


def promote(disease: str, version_dir: Path) -> None:
    """Atomically copy the staged artifacts over the active bundle."""
    stem = disease.lower()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    for suffix in ARTIFACT_SUFFIXES:
        src = version_dir / f"{stem}{suffix}"
        dst = ARTIFACTS / f"{stem}{suffix}"
        tmp = dst.with_suffix(dst.suffix + ".tmp")
        shutil.copy2(src, tmp)
        tmp.replace(dst)  # atomic on same filesystem


# --------------------------------------------------------------------------- #
# Live-service hot reload (non-blocking, best-effort)
# --------------------------------------------------------------------------- #

def reload_service(timeout: float = 5.0) -> Optional[str]:
    url = _read_ml_service_url().rstrip("/") + "/reload"
    try:
        req = urllib.request.Request(url, data=b"", method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", "replace")
        print(f"[retrain] Live service reloaded: {url}")
        return body
    except (urllib.error.URLError, OSError) as exc:
        print(
            f"[retrain] Could not reach live service at {url} ({exc}). "
            "New model will be loaded on the next service start / request."
        )
        return None


# --------------------------------------------------------------------------- #
# Retention
# --------------------------------------------------------------------------- #

def prune_versions(keep: int, active_tag: str) -> None:
    if keep <= 0 or not VERSIONS_DIR.is_dir():
        return
    dirs = sorted(
        (p for p in VERSIONS_DIR.iterdir() if p.is_dir()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in dirs[keep:]:
        if old.name == active_tag:
            continue
        shutil.rmtree(old, ignore_errors=True)


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #

def run(args: argparse.Namespace) -> int:
    started = _now_iso()
    exclude_synthetic = not args.allow_synthetic

    if not args.skip_build:
        rebuild_dataset(exclude_synthetic=exclude_synthetic)
    else:
        print("[retrain] --skip-build set: reusing existing training CSV.")

    cfg = trainer.load_config(
        Path(args.config),
        overrides={"epochs": args.epochs, "hidden": args.hidden},
    )
    trainer.set_seed(cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if not cfg.data_csv.is_file():
        raise RuntimeError(f"Training CSV not found: {cfg.data_csv}")
    df = pd.read_csv(cfg.data_csv)
    total_rows = int(len(df))

    VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
    version_tag = _resolve_version_tag(VERSIONS_DIR)
    version_dir = VERSIONS_DIR / version_tag
    version_dir.mkdir(parents=True, exist_ok=True)
    print(f"[retrain] Version: {version_tag}")
    print(f"[retrain] Dataset: {cfg.data_csv} ({total_rows} rows, "
          f"synthetic_excluded={exclude_synthetic})")

    # Stage training into the version dir (active bundle untouched).
    staged_cfg = dataclasses.replace(cfg, artifacts_dir=version_dir)

    diseases = DISEASES if args.disease.lower() == "all" else [args.disease.upper()]
    decisions: list[Decision] = []
    dataset_sizes: dict[str, dict] = {}

    for disease in diseases:
        print(f"\n[retrain] === Training {disease} -> {version_dir} ===")
        try:
            metrics = trainer.train_one(disease, df, staged_cfg, device)
        except Exception as exc:  # training failed for this disease
            print(f"[retrain] {disease} training FAILED: {exc}")
            decisions.append(Decision(disease, "failed", f"training error: {exc}"))
            continue

        dataset_sizes[disease] = {
            "train_samples": metrics.get("train_samples"),
            "val_samples": metrics.get("val_samples"),
            "test_samples": metrics.get("test_samples"),
        }
        decision = evaluate_candidate(
            disease, version_dir, metrics, args.max_mape_degradation, args.force
        )
        if decision.status == "promoted":
            promote(disease, version_dir)
            print(f"[retrain] {disease} PROMOTED: {decision.reason}")
        elif decision.status == "fallback":
            print(f"[retrain] {disease} FALLBACK: {decision.reason}")
        else:
            print(f"[retrain] {disease} FAILED: {decision.reason}")
        decisions.append(decision)

    promoted = [d.disease for d in decisions if d.status == "promoted"]

    # Update the active-version pointer (per-disease) for traceability.
    active_pointer = {}
    if ACTIVE_VERSION_FILE.is_file():
        active_pointer = _load_metrics(ACTIVE_VERSION_FILE) or {}
    active_pointer.setdefault("diseases", {})
    for disease in promoted:
        active_pointer["diseases"][disease] = version_tag
    active_pointer["updated_at"] = _now_iso()
    ACTIVE_VERSION_FILE.write_text(json.dumps(active_pointer, indent=2), encoding="utf-8")

    # Append the audit log entry.
    log_entry = {
        "timestamp": started,
        "completed_at": _now_iso(),
        "version": version_tag,
        "data_csv": str(cfg.data_csv),
        "dataset_total_rows": total_rows,
        "synthetic_excluded": exclude_synthetic,
        "max_mape_degradation": args.max_mape_degradation,
        "diseases": {
            d.disease: {
                "status": d.status,
                "reason": d.reason,
                "new_mape": d.new_mape,
                "active_mape": d.active_mape,
                "train_samples": d.train_samples,
                "test_samples": d.test_samples,
            }
            for d in decisions
        },
        "promoted": promoted,
    }
    RETRAIN_LOG.parent.mkdir(parents=True, exist_ok=True)
    with RETRAIN_LOG.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(log_entry) + "\n")
    print(f"\n[retrain] Logged run to {RETRAIN_LOG}")

    # Hot-reload the live service if anything changed.
    if promoted and not args.no_reload:
        reload_service()
    elif not promoted:
        print("[retrain] Nothing promoted — active model unchanged, no reload needed.")

    prune_versions(args.keep_versions, version_tag)

    print(
        f"[retrain] DONE. version={version_tag} "
        f"promoted={promoted or 'none'} "
        f"fallback={[d.disease for d in decisions if d.status == 'fallback'] or 'none'} "
        f"failed={[d.disease for d in decisions if d.status == 'failed'] or 'none'}"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="ALERTO weekly automated retraining")
    p.add_argument("--disease", default="all", help="ILI | DENGUE | AWD | all")
    p.add_argument("--config", default=str(Path(__file__).with_name("config.yaml")))
    p.add_argument("--epochs", type=int, default=None)
    p.add_argument("--hidden", type=int, default=None)
    p.add_argument(
        "--skip-build", action="store_true",
        help="Reuse the existing training CSV instead of rebuilding from MySQL.",
    )
    p.add_argument(
        "--allow-synthetic", action="store_true",
        help="Escape hatch: include SYN-%% synthetic rows (NOT for production).",
    )
    p.add_argument(
        "--max-mape-degradation", type=float, default=0.10,
        help="Max allowed test-MAPE increase vs the active model (default 0.10 = 10%%).",
    )
    p.add_argument(
        "--force", action="store_true",
        help="Promote even if the candidate is degraded or unvalidatable.",
    )
    p.add_argument(
        "--no-reload", action="store_true",
        help="Do not POST /reload to the live service after promotion.",
    )
    p.add_argument(
        "--keep-versions", type=int, default=8,
        help="Number of recent version dirs to retain (default 8; 0 = keep all).",
    )
    args = p.parse_args(argv)
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
