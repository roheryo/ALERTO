"""Train the ALERTO LSTM forecaster (1..4-week ahead case counts).

Usage
-----
    python ml/train.py --disease ILI
    python ml/train.py --disease DENGUE
    python ml/train.py --disease AWD
    python ml/train.py --disease all          # train all three sequentially
    python ml/train.py --disease ILI --epochs 100 --hidden 96

Outputs (per disease, lowercased) into ml/artifacts/:
    {disease}_lstm.pt        # PyTorch state_dict
    {disease}_scaler.joblib  # StandardScaler fitted on train features
    {disease}_config.json    # feature/target columns, lookback, horizon
    {disease}_metrics.json   # test MAPE / RMSE / MAE, sample counts
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import yaml
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))

from model_lstm import CaseLSTM  # noqa: E402


# --------------------------------------------------------------------------- #
# Config + dataset helpers
# --------------------------------------------------------------------------- #

@dataclass
class TrainConfig:
    lookback: int
    horizon: int
    feature_columns: List[str]
    target_columns: List[str]
    target_transform: str
    hidden: int
    dropout: float
    batch_size: int
    epochs: int
    lr: float
    weight_decay: float
    patience: int
    seed: int
    data_csv: Path
    artifacts_dir: Path


def load_config(path: Path, overrides: dict | None = None) -> TrainConfig:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    paths = raw.get("paths", {})
    model = raw.get("model", {})
    train = raw.get("train", {})
    overrides = overrides or {}

    return TrainConfig(
        lookback=int(raw["lookback_weeks"]),
        horizon=int(raw["horizon_weeks"]),
        feature_columns=list(raw["feature_columns"]),
        target_columns=list(raw["target_columns"]),
        target_transform=str(raw.get("target_transform", "log1p")),
        hidden=int(overrides.get("hidden") or model.get("hidden_size", 64)),
        dropout=float(model.get("dropout", 0.2)),
        batch_size=int(train.get("batch_size", 32)),
        epochs=int(overrides.get("epochs") or train.get("epochs", 200)),
        lr=float(train.get("learning_rate", 1e-3)),
        weight_decay=float(train.get("weight_decay", 0.0)),
        patience=int(train.get("early_stopping_patience", 20)),
        seed=int(train.get("seed", 42)),
        data_csv=ROOT / paths.get("data_csv", "data/processed/surveillance_weekly_training.csv"),
        artifacts_dir=ROOT / paths.get("artifacts_dir", "ml/artifacts"),
    )


def set_seed(seed: int) -> None:
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


# --------------------------------------------------------------------------- #
# Sequence construction
# --------------------------------------------------------------------------- #

def _series_for(df: pd.DataFrame, municipality_id: int) -> pd.DataFrame:
    """Return chronologically sorted weekly rows for one municipality+disease."""
    sub = df[df["municipality_id"] == municipality_id].copy()
    sub = sub.sort_values("week_start").reset_index(drop=True)
    return sub


def _windows_from_series(
    series: pd.DataFrame,
    feature_cols: List[str],
    target_cols: List[str],
    lookback: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Build (X[L,F], y[H], split_label) windows from one ordered series.

    A window at position t uses rows [t-L+1 .. t] as input and targets at row t.
    The target columns (cases_t_plus_1..4) are already engineered in the CSV.
    """
    feats = series[feature_cols].astype(float).fillna(0.0).to_numpy()
    targs = series[target_cols].astype(float).fillna(0.0).to_numpy()
    split = series["split"].fillna("train").to_numpy()

    xs, ys, sp = [], [], []
    for t in range(lookback - 1, len(series)):
        xs.append(feats[t - lookback + 1 : t + 1])
        ys.append(targs[t])
        sp.append(split[t])
    if not xs:
        return (
            np.empty((0, lookback, len(feature_cols)), dtype=np.float32),
            np.empty((0, len(target_cols)), dtype=np.float32),
            np.empty((0,), dtype=object),
        )
    return (
        np.asarray(xs, dtype=np.float32),
        np.asarray(ys, dtype=np.float32),
        np.asarray(sp),
    )


def build_dataset(
    df: pd.DataFrame, cfg: TrainConfig
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Aggregate windows across all municipalities and split into train/val/test."""
    X_all, y_all, split_all = [], [], []
    for muni in sorted(df["municipality_id"].unique()):
        series = _series_for(df, int(muni))
        if len(series) < cfg.lookback + 1:
            continue
        X, y, sp = _windows_from_series(
            series, cfg.feature_columns, cfg.target_columns, cfg.lookback
        )
        X_all.append(X)
        y_all.append(y)
        split_all.append(sp)

    X = np.concatenate(X_all, axis=0) if X_all else np.empty((0,))
    y = np.concatenate(y_all, axis=0) if y_all else np.empty((0,))
    sp = np.concatenate(split_all, axis=0) if split_all else np.empty((0,), dtype=object)

    train_mask = sp == "train"
    val_mask = sp == "val"
    test_mask = sp == "test"

    return (
        X[train_mask], y[train_mask],
        X[val_mask], y[val_mask],
        X[test_mask], y[test_mask],
    )


def scale_features(
    X_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray
) -> Tuple[StandardScaler, np.ndarray, np.ndarray, np.ndarray]:
    """Fit StandardScaler on flattened train features; apply to val/test."""
    n_features = X_train.shape[-1]
    scaler = StandardScaler()
    scaler.fit(X_train.reshape(-1, n_features))

    def apply(arr: np.ndarray) -> np.ndarray:
        if arr.size == 0:
            return arr
        flat = scaler.transform(arr.reshape(-1, n_features))
        return flat.reshape(arr.shape).astype(np.float32)

    return scaler, apply(X_train), apply(X_val), apply(X_test)


def transform_targets(y: np.ndarray, mode: str) -> np.ndarray:
    if mode == "log1p":
        return np.log1p(np.clip(y, a_min=0.0, a_max=None)).astype(np.float32)
    return y.astype(np.float32)


def inverse_targets(y: np.ndarray, mode: str) -> np.ndarray:
    if mode == "log1p":
        return np.expm1(y)
    return y


# --------------------------------------------------------------------------- #
# Metrics
# --------------------------------------------------------------------------- #

def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Percentage Error with epsilon (safe for zero weeks)."""
    denom = np.maximum(np.abs(y_true), 1.0)
    return float(np.mean(np.abs(y_pred - y_true) / denom))


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(math.sqrt(np.mean((y_pred - y_true) ** 2)))


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_pred - y_true)))


# --------------------------------------------------------------------------- #
# Training loop
# --------------------------------------------------------------------------- #

def train_one(
    disease: str, df: pd.DataFrame, cfg: TrainConfig, device: torch.device
) -> dict:
    sub = df[df["disease_code"] == disease].copy()
    if sub.empty:
        raise ValueError(f"No rows for disease={disease!r} in training CSV")

    X_tr, y_tr_raw, X_va, y_va_raw, X_te, y_te_raw = build_dataset(sub, cfg)
    if X_tr.shape[0] == 0:
        raise ValueError(
            f"Empty training split for disease={disease!r}. The build-ml-"
            "datasets script defaults to form-only confirmed cases — if the "
            "report-case form has not yet collected enough rows you can fall "
            "back to historical data with:\n"
            "    node backend/scripts/build-ml-datasets.mjs --include-imported\n"
            "    npm run ml:train"
        )

    scaler, X_tr_s, X_va_s, X_te_s = scale_features(X_tr, X_va, X_te)
    y_tr = transform_targets(y_tr_raw, cfg.target_transform)
    y_va = transform_targets(y_va_raw, cfg.target_transform)

    train_ds = TensorDataset(torch.from_numpy(X_tr_s), torch.from_numpy(y_tr))
    val_ds = TensorDataset(torch.from_numpy(X_va_s), torch.from_numpy(y_va))
    train_dl = DataLoader(train_ds, batch_size=cfg.batch_size, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=cfg.batch_size)

    model = CaseLSTM(
        n_features=X_tr_s.shape[-1],
        hidden=cfg.hidden,
        dropout=cfg.dropout,
        horizon=cfg.horizon,
    ).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    loss_fn = nn.MSELoss()

    best_val = float("inf")
    best_state = None
    stale = 0

    for epoch in range(1, cfg.epochs + 1):
        model.train()
        train_loss = 0.0
        for xb, yb in train_dl:
            xb = xb.to(device)
            yb = yb.to(device)
            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            opt.step()
            train_loss += loss.item() * xb.size(0)
        train_loss /= max(1, len(train_ds))

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for xb, yb in val_dl:
                xb = xb.to(device)
                yb = yb.to(device)
                pred = model(xb)
                val_loss += loss_fn(pred, yb).item() * xb.size(0)
        val_loss /= max(1, len(val_ds))

        if val_loss < best_val - 1e-6:
            best_val = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            stale = 0
        else:
            stale += 1

        if epoch == 1 or epoch % 10 == 0 or stale == 0:
            print(
                f"[{disease}] epoch {epoch:3d}/{cfg.epochs} "
                f"train_loss={train_loss:.5f} val_loss={val_loss:.5f} "
                f"best_val={best_val:.5f}"
            )
        if stale >= cfg.patience:
            print(f"[{disease}] early stopping at epoch {epoch} (patience={cfg.patience})")
            break

    if best_state is not None:
        model.load_state_dict(best_state)

    # Final test evaluation on original scale
    model.eval()
    with torch.no_grad():
        if X_te_s.shape[0]:
            pred_log = model(torch.from_numpy(X_te_s).to(device)).cpu().numpy()
        else:
            pred_log = np.empty((0, cfg.horizon), dtype=np.float32)
    pred = inverse_targets(pred_log, cfg.target_transform)
    pred = np.clip(np.round(pred), 0, None)

    metrics = {
        "disease": disease,
        "framework": "pytorch",
        "train_samples": int(X_tr.shape[0]),
        "val_samples": int(X_va.shape[0]),
        "test_samples": int(X_te.shape[0]),
        "lookback": cfg.lookback,
        "horizon": cfg.horizon,
        "device": str(device),
    }

    if X_te.shape[0]:
        metrics["test_mape"] = mape(y_te_raw, pred)
        metrics["test_rmse"] = rmse(y_te_raw, pred)
        metrics["test_mae"] = mae(y_te_raw, pred)
        per_horizon = []
        for h in range(cfg.horizon):
            per_horizon.append({
                "step": h + 1,
                "mape": mape(y_te_raw[:, h], pred[:, h]),
                "rmse": rmse(y_te_raw[:, h], pred[:, h]),
                "mae": mae(y_te_raw[:, h], pred[:, h]),
            })
        metrics["per_horizon"] = per_horizon
    else:
        metrics["test_mape"] = None
        metrics["test_rmse"] = None
        metrics["test_mae"] = None

    # Persist artifacts
    cfg.artifacts_dir.mkdir(parents=True, exist_ok=True)
    stem = disease.lower()
    torch.save(model.state_dict(), cfg.artifacts_dir / f"{stem}_lstm.pt")
    joblib.dump(scaler, cfg.artifacts_dir / f"{stem}_scaler.joblib")
    (cfg.artifacts_dir / f"{stem}_config.json").write_text(
        json.dumps(
            {
                "feature_columns": cfg.feature_columns,
                "target_columns": cfg.target_columns,
                "lookback_weeks": cfg.lookback,
                "horizon_weeks": cfg.horizon,
                "target_transform": cfg.target_transform,
                "hidden": cfg.hidden,
                "dropout": cfg.dropout,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    (cfg.artifacts_dir / f"{stem}_metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )

    print(
        f"[{disease}] DONE  train={metrics['train_samples']} "
        f"val={metrics['val_samples']} test={metrics['test_samples']} "
        f"mape={metrics['test_mape']} rmse={metrics['test_rmse']}"
    )
    return metrics


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train ALERTO LSTM forecaster")
    parser.add_argument("--disease", default="ILI", help="ILI | DENGUE | AWD | all")
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.yaml")))
    parser.add_argument("--data", default=None, help="Override path to surveillance_weekly_training.csv")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--hidden", type=int, default=None)
    args = parser.parse_args(argv)

    cfg = load_config(
        Path(args.config),
        overrides={"epochs": args.epochs, "hidden": args.hidden},
    )
    if args.data:
        cfg.data_csv = Path(args.data)

    set_seed(cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Loading dataset: {cfg.data_csv}")
    df = pd.read_csv(cfg.data_csv)

    targets = (
        ["ILI", "DENGUE", "AWD"] if args.disease.lower() == "all" else [args.disease.upper()]
    )
    for disease in targets:
        train_one(disease, df, cfg, device)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
