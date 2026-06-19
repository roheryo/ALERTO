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
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
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
    grad_clip_norm: float = 0.0
    lr_scheduler_enabled: bool = False
    lr_scheduler_factor: float = 0.5
    lr_scheduler_patience: int = 8
    lr_scheduler_min_lr: float = 1e-5
    scaling: str = "global"
    disease_feature_columns: Dict[str, List[str]] = field(default_factory=dict)
    disease_overrides: Dict[str, dict] = field(default_factory=dict)
    loss_type: str = "mse"
    nonzero_weight: float = 1.0
    huber_delta: float = 1.0


def load_config(path: Path, overrides: dict | None = None) -> TrainConfig:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    paths = raw.get("paths", {})
    model = raw.get("model", {})
    train = raw.get("train", {})
    scheduler = train.get("lr_scheduler", {}) or {}
    loss = train.get("loss", {}) or {}
    disease_features = raw.get("disease_feature_columns", {}) or {}
    disease_features = {
        str(k).upper(): list(v) for k, v in disease_features.items() if v
    }
    disease_overrides = raw.get("disease_overrides", {}) or {}
    disease_overrides = {
        str(k).upper(): dict(v) for k, v in disease_overrides.items() if v
    }
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
        grad_clip_norm=float(train.get("grad_clip_norm", 0.0)),
        lr_scheduler_enabled=bool(scheduler.get("enabled", False)),
        lr_scheduler_factor=float(scheduler.get("factor", 0.5)),
        lr_scheduler_patience=int(scheduler.get("patience", 8)),
        lr_scheduler_min_lr=float(scheduler.get("min_lr", 1e-5)),
        scaling=str(raw.get("scaling", "global")).lower(),
        disease_feature_columns=disease_features,
        disease_overrides=disease_overrides,
        loss_type=str(loss.get("type", "mse")).lower(),
        nonzero_weight=float(loss.get("nonzero_weight", 1.0)),
        huber_delta=float(loss.get("huber_delta", 1.0)),
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


def build_dataset_grouped(
    df: pd.DataFrame, cfg: TrainConfig
) -> Tuple[
    np.ndarray, np.ndarray, np.ndarray,
    np.ndarray, np.ndarray, np.ndarray,
    np.ndarray, np.ndarray, np.ndarray,
]:
    """Like build_dataset but also returns the municipality id of every window.

    Used by the per-municipality scaling path (Phase 2). The returned group
    arrays (g_*) align row-for-row with the X_*/y_* splits.
    """
    X_all, y_all, split_all, group_all = [], [], [], []
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
        group_all.append(np.full((X.shape[0],), int(muni), dtype=np.int64))

    if not X_all:
        empty_x = np.empty((0, cfg.lookback, len(cfg.feature_columns)), dtype=np.float32)
        empty_y = np.empty((0, len(cfg.target_columns)), dtype=np.float32)
        empty_g = np.empty((0,), dtype=np.int64)
        return (empty_x, empty_y, empty_g, empty_x, empty_y, empty_g, empty_x, empty_y, empty_g)

    X = np.concatenate(X_all, axis=0)
    y = np.concatenate(y_all, axis=0)
    sp = np.concatenate(split_all, axis=0)
    g = np.concatenate(group_all, axis=0)

    tr, va, te = sp == "train", sp == "val", sp == "test"
    return (
        X[tr], y[tr], g[tr],
        X[va], y[va], g[va],
        X[te], y[te], g[te],
    )


def scale_features_per_muni(
    X_train: np.ndarray, g_train: np.ndarray,
    X_val: np.ndarray, g_val: np.ndarray,
    X_test: np.ndarray, g_test: np.ndarray,
) -> Tuple[dict, np.ndarray, np.ndarray, np.ndarray]:
    """Fit one StandardScaler per municipality (Phase 2).

    Returns a dict scaler bundle ``{muni_id: StandardScaler, "__global__": ...}``.
    The global scaler (fitted on all train windows) is the fallback for windows
    whose municipality has no train data and for unseen ids at inference time.
    """
    n_features = X_train.shape[-1]
    global_scaler = StandardScaler().fit(X_train.reshape(-1, n_features))

    scalers: dict = {"__global__": global_scaler}
    for muni in np.unique(g_train):
        rows = X_train[g_train == muni]
        if rows.shape[0] == 0:
            continue
        scalers[int(muni)] = StandardScaler().fit(rows.reshape(-1, n_features))

    def apply(arr: np.ndarray, groups: np.ndarray) -> np.ndarray:
        if arr.size == 0:
            return arr
        out = np.empty_like(arr, dtype=np.float32)
        for i in range(arr.shape[0]):
            sc = scalers.get(int(groups[i]), global_scaler)
            out[i] = sc.transform(arr[i].reshape(-1, n_features)).reshape(arr[i].shape)
        return out

    return (
        scalers,
        apply(X_train, g_train),
        apply(X_val, g_val),
        apply(X_test, g_test),
    )


def make_loss_fn(cfg: TrainConfig):
    """Return a callable loss(pred, target) honouring the configured loss type.

    Targets are in (log1p) transformed space; since log1p is monotonic and
    log1p(0)=0, the ``target > 0`` mask still selects weeks that had cases.
    """
    loss_type = cfg.loss_type

    if loss_type == "huber":
        def _huber(pred, target):
            return F.smooth_l1_loss(pred, target, beta=cfg.huber_delta)
        return _huber

    if loss_type == "weighted_mse":
        w_pos = float(cfg.nonzero_weight)

        def _weighted(pred, target):
            weights = torch.where(
                target > 0,
                torch.as_tensor(w_pos, dtype=pred.dtype, device=pred.device),
                torch.as_tensor(1.0, dtype=pred.dtype, device=pred.device),
            )
            return (weights * (pred - target) ** 2).mean()
        return _weighted

    return lambda pred, target: F.mse_loss(pred, target)


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


def smape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Symmetric MAPE in [0, 2]; far less explosive than MAPE on sparse counts."""
    denom = np.abs(y_true) + np.abs(y_pred)
    denom = np.where(denom == 0.0, 1.0, denom)
    return float(np.mean(2.0 * np.abs(y_pred - y_true) / denom))


def mape_nonzero(y_true: np.ndarray, y_pred: np.ndarray) -> float | None:
    """MAPE computed only over weeks that actually had cases (y_true > 0).

    Answers the operationally relevant question: "when cases occur, how far off
    are we?" Returns None when the slice has no non-zero observations.
    """
    mask = y_true > 0
    if not np.any(mask):
        return None
    return float(np.mean(np.abs(y_pred[mask] - y_true[mask]) / y_true[mask]))


def accuracy_within(y_true: np.ndarray, y_pred: np.ndarray, tol: float) -> float:
    """Fraction of forecasts whose absolute error is within `tol` cases.

    This is the operationally interpretable "accuracy" for a count forecaster:
    e.g. tol=1 → share of (sample, horizon) predictions off by at most 1 case.
    Reported alongside the error metrics because stakeholders read a 0..1 (%)
    number more easily than RMSE/MAE on a sparse-count series.
    """
    if y_true.size == 0:
        return float("nan")
    return float(np.mean(np.abs(y_pred - y_true) <= tol))


def direction_accuracy(
    y_true: np.ndarray, y_pred: np.ndarray, last_obs: np.ndarray
) -> float | None:
    """Share of forecasts that get the *trend* right vs the last observed week.

    For each horizon step we compare sign(forecast - last_observed) against
    sign(actual - last_observed). Flat (0) moves must also match. This answers
    "did we correctly call cases going up / down / steady?" — the question an
    early-warning system is really judged on.
    """
    if y_true.size == 0:
        return None
    base = last_obs.reshape(-1, 1)
    true_dir = np.sign(y_true - base)
    pred_dir = np.sign(y_pred - base)
    return float(np.mean(true_dir == pred_dir))


def mase(y_true: np.ndarray, y_pred: np.ndarray, y_naive: np.ndarray) -> float | None:
    """Mean Absolute Scaled Error vs a naive persistence forecast.

    MASE < 1 means the model beats simply repeating the last observed count.
    Scale-free and well-defined on zero-heavy series, so it is the most honest
    headline metric for this sparse-count problem. Returns None if the naive
    forecast is perfect (degenerate denominator).
    """
    naive_mae = float(np.mean(np.abs(y_naive - y_true)))
    if naive_mae == 0.0:
        return None
    return mae(y_true, y_pred) / naive_mae


# --------------------------------------------------------------------------- #
# Training loop
# --------------------------------------------------------------------------- #

def train_one(
    disease: str, df: pd.DataFrame, cfg: TrainConfig, device: torch.device
) -> dict:
    # Seed per disease so each model trains deterministically regardless of how
    # many diseases ran before it (otherwise ILI's RNG draw shifts DENGUE/AWD).
    # This makes train.py and tune.py reproduce identical per-disease results.
    set_seed(cfg.seed)

    sub = df[df["disease_code"] == disease].copy()
    if sub.empty:
        raise ValueError(f"No rows for disease={disease!r} in training CSV")

    # Phase 2: per-disease feature set (falls back to the shared list). Replacing
    # cfg.feature_columns here keeps build_dataset and the persisted config.json
    # consistent with the columns actually used to train this disease.
    disease_features = cfg.disease_feature_columns.get(disease.upper())
    if disease_features:
        cfg = replace(cfg, feature_columns=list(disease_features))
        print(f"[{disease}] using {len(cfg.feature_columns)} disease-specific features")

    # Phase 3: per-disease hyper-parameter overrides (from ml/tune.py). Only the
    # known TrainConfig knobs are accepted; everything else stays as configured.
    disease_override = cfg.disease_overrides.get(disease.upper())
    if disease_override:
        _ALLOWED = {
            "loss_type", "nonzero_weight", "huber_delta", "dropout",
            "weight_decay", "hidden", "lr", "lookback", "patience",
            "grad_clip_norm",
        }
        applied = {}
        for k, v in disease_override.items():
            key = "lr" if k == "learning_rate" else ("lookback" if k == "lookback_weeks" else k)
            if key in _ALLOWED:
                applied[key] = str(v).lower() if key == "loss_type" else v
        if applied:
            cfg = replace(cfg, **applied)
            print(f"[{disease}] applying overrides {applied}")

    # Phase 2: per-municipality scaling builds windows with their muni id so a
    # scaler can be fitted per location; otherwise use the global path.
    per_muni = cfg.scaling == "per_municipality"
    if per_muni:
        (X_tr, y_tr_raw, g_tr, X_va, y_va_raw, g_va,
         X_te, y_te_raw, g_te) = build_dataset_grouped(sub, cfg)
    else:
        X_tr, y_tr_raw, X_va, y_va_raw, X_te, y_te_raw = build_dataset(sub, cfg)
        g_tr = g_va = g_te = None
    if X_tr.shape[0] == 0:
        raise ValueError(
            f"Empty training split for disease={disease!r}. The build-ml-"
            "datasets script defaults to form-only confirmed cases — if the "
            "report-case form has not yet collected enough rows you can fall "
            "back to historical data with:\n"
            "    node backend/scripts/build-ml-datasets.mjs --include-imported\n"
            "    npm run ml:train"
        )

    if per_muni:
        scaler, X_tr_s, X_va_s, X_te_s = scale_features_per_muni(
            X_tr, g_tr, X_va, g_va, X_te, g_te
        )
        print(f"[{disease}] per-municipality scaling: {len(scaler) - 1} muni scalers")
    else:
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
    loss_fn = make_loss_fn(cfg)

    scheduler = None
    if cfg.lr_scheduler_enabled:
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            opt,
            mode="min",
            factor=cfg.lr_scheduler_factor,
            patience=cfg.lr_scheduler_patience,
            min_lr=cfg.lr_scheduler_min_lr,
        )

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
            if cfg.grad_clip_norm and cfg.grad_clip_norm > 0:
                nn.utils.clip_grad_norm_(model.parameters(), cfg.grad_clip_norm)
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

        if scheduler is not None:
            scheduler.step(val_loss)

        if val_loss < best_val - 1e-6:
            best_val = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            stale = 0
        else:
            stale += 1

        if epoch == 1 or epoch % 10 == 0 or stale == 0:
            current_lr = opt.param_groups[0]["lr"]
            print(
                f"[{disease}] epoch {epoch:3d}/{cfg.epochs} "
                f"train_loss={train_loss:.5f} val_loss={val_loss:.5f} "
                f"best_val={best_val:.5f} lr={current_lr:.2e}"
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

    # Naive persistence baseline for MASE: repeat the last observed (unscaled)
    # case_count of each window across all horizon steps.
    cc_idx = cfg.feature_columns.index("case_count") if "case_count" in cfg.feature_columns else None
    if cc_idx is not None and X_te.shape[0]:
        last_obs = X_te[:, -1, cc_idx]
        naive_pred = np.repeat(last_obs.reshape(-1, 1), cfg.horizon, axis=1)
    else:
        naive_pred = None

    # Validation predictions on the original scale — used for loss-agnostic
    # model/hyper-parameter selection (val loss is not comparable across loss
    # types, but val MAE/MASE on real counts always is).
    with torch.no_grad():
        if X_va_s.shape[0]:
            val_pred = inverse_targets(
                model(torch.from_numpy(X_va_s).to(device)).cpu().numpy(),
                cfg.target_transform,
            )
            val_pred = np.clip(np.round(val_pred), 0, None)
        else:
            val_pred = np.empty((0, cfg.horizon), dtype=np.float32)
    val_naive = (
        np.repeat(X_va[:, -1, cc_idx].reshape(-1, 1), cfg.horizon, axis=1)
        if (cc_idx is not None and X_va.shape[0])
        else None
    )

    metrics = {
        "disease": disease,
        "framework": "pytorch",
        "train_samples": int(X_tr.shape[0]),
        "val_samples": int(X_va.shape[0]),
        "test_samples": int(X_te.shape[0]),
        "n_features": int(X_tr.shape[-1]),
        "lookback": cfg.lookback,
        "horizon": cfg.horizon,
        "scaling": cfg.scaling,
        "loss_type": cfg.loss_type,
        "device": str(device),
        "val_loss": float(best_val) if math.isfinite(best_val) else None,
    }

    # Validation metrics on original scale (selection criterion for tuning).
    if val_pred.shape[0]:
        metrics["val_mae"] = mae(y_va_raw, val_pred)
        metrics["val_rmse"] = rmse(y_va_raw, val_pred)
        metrics["val_mape"] = mape(y_va_raw, val_pred)
        metrics["val_mase"] = (
            mase(y_va_raw, val_pred, val_naive) if val_naive is not None else None
        )
    else:
        metrics["val_mae"] = metrics["val_rmse"] = None
        metrics["val_mape"] = metrics["val_mase"] = None

    if X_te.shape[0]:
        metrics["test_mape"] = mape(y_te_raw, pred)
        metrics["test_smape"] = smape(y_te_raw, pred)
        metrics["test_mape_nonzero"] = mape_nonzero(y_te_raw, pred)
        metrics["test_rmse"] = rmse(y_te_raw, pred)
        metrics["test_mae"] = mae(y_te_raw, pred)
        metrics["test_mase"] = (
            mase(y_te_raw, pred, naive_pred) if naive_pred is not None else None
        )
        # Interpretable "accuracy" framing for stakeholders.
        metrics["test_acc_within_1"] = accuracy_within(y_te_raw, pred, 1.0)
        metrics["test_acc_within_2"] = accuracy_within(y_te_raw, pred, 2.0)
        metrics["test_direction_acc"] = (
            direction_accuracy(y_te_raw, pred, last_obs) if naive_pred is not None else None
        )
        per_horizon = []
        for h in range(cfg.horizon):
            per_horizon.append({
                "step": h + 1,
                "mape": mape(y_te_raw[:, h], pred[:, h]),
                "smape": smape(y_te_raw[:, h], pred[:, h]),
                "mape_nonzero": mape_nonzero(y_te_raw[:, h], pred[:, h]),
                "rmse": rmse(y_te_raw[:, h], pred[:, h]),
                "mae": mae(y_te_raw[:, h], pred[:, h]),
                "mase": (
                    mase(y_te_raw[:, h], pred[:, h], naive_pred[:, h])
                    if naive_pred is not None
                    else None
                ),
            })
        metrics["per_horizon"] = per_horizon
    else:
        metrics["test_mape"] = None
        metrics["test_smape"] = None
        metrics["test_mape_nonzero"] = None
        metrics["test_rmse"] = None
        metrics["test_mae"] = None
        metrics["test_mase"] = None

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
                "weight_decay": cfg.weight_decay,
                "learning_rate": cfg.lr,
                "grad_clip_norm": cfg.grad_clip_norm,
                "lr_scheduler_enabled": cfg.lr_scheduler_enabled,
                "scaling": cfg.scaling,
                "loss_type": cfg.loss_type,
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
        f"feats={metrics['n_features']} "
        f"mape={metrics['test_mape']} mae={metrics['test_mae']} "
        f"mase={metrics['test_mase']} rmse={metrics['test_rmse']} "
        f"acc±1={metrics.get('test_acc_within_1')} dir_acc={metrics.get('test_direction_acc')}"
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
