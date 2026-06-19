"""Benchmark the LSTM against the baselines required by thesis §2.5.

Baselines implemented:
  - Naive seasonal persistence : y_hat[t+k] = y[t]
  - Ridge regression           : linear model on flattened lookback window
  - SVR (RBF kernel)           : per-horizon-step support vector regressor
  - ARIMA (per municipality)   : optional, only if `statsmodels` is installed

Metrics reported: MAPE, RMSE, MAE (overall and per-horizon-step).

Usage
-----
    python ml/evaluate_baselines.py --disease ILI
    python ml/evaluate_baselines.py --disease all
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import torch
from sklearn.linear_model import Ridge
from sklearn.svm import SVR

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ml"))

from model_lstm import CaseLSTM  # noqa: E402
from train import (  # noqa: E402
    build_dataset,
    build_dataset_grouped,
    inverse_targets,
    load_config,
    mae,
    mape,
    rmse,
    scale_features,
    set_seed,
    transform_targets,
)


# --------------------------------------------------------------------------- #
# Baseline predictors
# --------------------------------------------------------------------------- #

def naive_persistence(X_test_raw: np.ndarray, feature_columns: List[str]) -> np.ndarray:
    """Forecast every future step as the last observed case_count."""
    if "case_count" not in feature_columns:
        return np.zeros((X_test_raw.shape[0], 0))
    idx = feature_columns.index("case_count")
    last = X_test_raw[:, -1, idx]
    horizon = 4  # filled below by caller via broadcasting
    return last.reshape(-1, 1).repeat(horizon, axis=1)


def fit_ridge(X_tr: np.ndarray, y_tr: np.ndarray) -> Ridge:
    flat = X_tr.reshape(X_tr.shape[0], -1)
    model = Ridge(alpha=1.0)
    model.fit(flat, y_tr)
    return model


def predict_ridge(model: Ridge, X: np.ndarray) -> np.ndarray:
    if X.shape[0] == 0:
        return np.empty((0, model.coef_.shape[0] if model.coef_.ndim > 1 else 1))
    return model.predict(X.reshape(X.shape[0], -1))


def fit_svr_per_horizon(X_tr: np.ndarray, y_tr: np.ndarray) -> List[SVR]:
    flat = X_tr.reshape(X_tr.shape[0], -1)
    models: List[SVR] = []
    for h in range(y_tr.shape[1]):
        svr = SVR(kernel="rbf", C=1.0, epsilon=0.1)
        svr.fit(flat, y_tr[:, h])
        models.append(svr)
    return models


def predict_svr(models: List[SVR], X: np.ndarray) -> np.ndarray:
    if X.shape[0] == 0:
        return np.empty((0, len(models)))
    flat = X.reshape(X.shape[0], -1)
    return np.stack([m.predict(flat) for m in models], axis=1)


def predict_arima(
    df: pd.DataFrame, horizon: int
) -> Tuple[np.ndarray, np.ndarray]:
    """Per-municipality ARIMA on case_count time series.

    Returns (y_true, y_pred) aligned across all test rows for the disease.
    Skipped silently if statsmodels is unavailable. NaN forecasts (from
    convergence failures on flat-zero series) are coerced to 0 so the
    benchmark table remains comparable.
    """
    try:
        import warnings

        from statsmodels.tools.sm_exceptions import ConvergenceWarning  # type: ignore
        from statsmodels.tsa.arima.model import ARIMA  # type: ignore

        warnings.simplefilter("ignore", ConvergenceWarning)
    except Exception:
        return np.empty((0, horizon)), np.empty((0, horizon))

    y_true_chunks: List[np.ndarray] = []
    y_pred_chunks: List[np.ndarray] = []

    for muni in sorted(df["municipality_id"].unique()):
        series = df[df["municipality_id"] == muni].sort_values("week_start").reset_index(drop=True)
        train_series = series[series["split"] == "train"]["case_count"].astype(float).to_numpy()
        test_rows = series[series["split"] == "test"]
        if len(train_series) < 20 or test_rows.empty:
            continue
        # Degenerate series (all zeros or near-zero variance) — ARIMA cannot fit;
        # fall back to a zero forecast so the benchmark still contributes rows.
        if float(np.std(train_series)) < 1e-9:
            preds_all = np.zeros(len(test_rows) + horizon, dtype=float)
        else:
            try:
                model = ARIMA(train_series, order=(2, 1, 1))
                fitted = model.fit()
                preds_all = np.asarray(fitted.forecast(steps=len(test_rows) + horizon), dtype=float)
            except Exception:
                continue
            preds_all = np.nan_to_num(preds_all, nan=0.0, posinf=0.0, neginf=0.0)

        target_cols = [f"cases_t_plus_{h+1}" for h in range(horizon)]
        targets = test_rows[target_cols].astype(float).fillna(0.0).to_numpy()
        for i in range(len(test_rows)):
            preds = preds_all[i : i + horizon]
            if len(preds) < horizon:
                break
            y_true_chunks.append(targets[i])
            y_pred_chunks.append(preds)

    if not y_true_chunks:
        return np.empty((0, horizon)), np.empty((0, horizon))
    y_true_arr = np.nan_to_num(np.stack(y_true_chunks), nan=0.0)
    y_pred_arr = np.nan_to_num(np.stack(y_pred_chunks), nan=0.0, posinf=0.0, neginf=0.0)
    return y_true_arr, np.clip(y_pred_arr, 0, None)


# --------------------------------------------------------------------------- #
# LSTM loader
# --------------------------------------------------------------------------- #

def load_trained_lstm(disease: str, cfg) -> Tuple[CaseLSTM, object, dict]:
    stem = disease.lower()
    art = cfg.artifacts_dir
    state = torch.load(art / f"{stem}_lstm.pt", map_location="cpu", weights_only=True)
    scaler = joblib.load(art / f"{stem}_scaler.joblib")
    bundle = json.loads((art / f"{stem}_config.json").read_text(encoding="utf-8"))

    model = CaseLSTM(
        n_features=len(bundle["feature_columns"]),
        hidden=int(bundle.get("hidden", 64)),
        dropout=float(bundle.get("dropout", 0.2)),
        horizon=int(bundle["horizon_weeks"]),
    )
    model.load_state_dict(state)
    model.eval()
    return model, scaler, bundle


def _apply_scaler(scaler, X: np.ndarray, groups: np.ndarray | None = None) -> np.ndarray:
    """Apply either a single StandardScaler or a per-municipality dict bundle."""
    n_features = X.shape[-1]
    if isinstance(scaler, dict):
        global_scaler = scaler.get("__global__")
        out = np.empty_like(X, dtype=np.float32)
        for i in range(X.shape[0]):
            sc = scaler.get(int(groups[i]), global_scaler) if groups is not None else global_scaler
            out[i] = sc.transform(X[i].reshape(-1, n_features)).reshape(X[i].shape)
        return out
    return scaler.transform(X.reshape(-1, n_features)).reshape(X.shape).astype(np.float32)


def predict_lstm(
    model: CaseLSTM, scaler, X_test: np.ndarray, transform: str,
    groups: np.ndarray | None = None,
) -> np.ndarray:
    if X_test.shape[0] == 0:
        return np.empty((0, 0))
    scaled = _apply_scaler(scaler, X_test, groups)
    with torch.no_grad():
        out = model(torch.from_numpy(scaled.astype(np.float32))).cpu().numpy()
    out = inverse_targets(out, transform)
    return np.clip(np.round(out), 0, None)


# --------------------------------------------------------------------------- #
# Driver
# --------------------------------------------------------------------------- #

def per_horizon_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> List[dict]:
    out: List[dict] = []
    for h in range(y_true.shape[1]):
        out.append({
            "step": h + 1,
            "mape": mape(y_true[:, h], y_pred[:, h]),
            "rmse": rmse(y_true[:, h], y_pred[:, h]),
            "mae": mae(y_true[:, h], y_pred[:, h]),
        })
    return out


def evaluate_disease(disease: str, df: pd.DataFrame, cfg) -> dict:
    sub = df[df["disease_code"] == disease].copy()

    # Phase 2: mirror train.py so the LSTM (trained on disease-specific features)
    # and the baselines are all evaluated on the same feature windows.
    disease_features = cfg.disease_feature_columns.get(disease.upper())
    if disease_features:
        cfg = replace(cfg, feature_columns=list(disease_features))

    # Track municipality ids only when per-municipality scaling is active so the
    # right scaler is applied to each LSTM test window.
    g_te = None
    if cfg.scaling == "per_municipality":
        _, _, _, _, _, _, X_te_grp, _, g_te = build_dataset_grouped(sub, cfg)
        del X_te_grp
    X_tr, y_tr, X_va, y_va, X_te, y_te = build_dataset(sub, cfg)
    if X_te.shape[0] == 0:
        return {"disease": disease, "test_rows": 0}

    summary: Dict[str, object] = {
        "disease": disease,
        "test_rows": int(X_te.shape[0]),
    }

    # Naive --------------------------------------------------------------
    naive_pred = naive_persistence(X_te, cfg.feature_columns)
    if naive_pred.shape[1] != cfg.horizon:
        naive_pred = np.repeat(naive_pred[:, :1], cfg.horizon, axis=1)
    summary["naive"] = {
        "mape": mape(y_te, naive_pred),
        "rmse": rmse(y_te, naive_pred),
        "mae": mae(y_te, naive_pred),
        "per_horizon": per_horizon_metrics(y_te, naive_pred),
    }

    # Ridge --------------------------------------------------------------
    ridge = fit_ridge(X_tr, y_tr)
    ridge_pred = np.clip(predict_ridge(ridge, X_te), 0, None)
    summary["ridge"] = {
        "mape": mape(y_te, ridge_pred),
        "rmse": rmse(y_te, ridge_pred),
        "mae": mae(y_te, ridge_pred),
        "per_horizon": per_horizon_metrics(y_te, ridge_pred),
    }

    # SVR ----------------------------------------------------------------
    svr_models = fit_svr_per_horizon(X_tr, y_tr)
    svr_pred = np.clip(predict_svr(svr_models, X_te), 0, None)
    summary["svr"] = {
        "mape": mape(y_te, svr_pred),
        "rmse": rmse(y_te, svr_pred),
        "mae": mae(y_te, svr_pred),
        "per_horizon": per_horizon_metrics(y_te, svr_pred),
    }

    # ARIMA (optional) ---------------------------------------------------
    arima_true, arima_pred = predict_arima(sub, cfg.horizon)
    if arima_true.size:
        summary["arima"] = {
            "mape": mape(arima_true, arima_pred),
            "rmse": rmse(arima_true, arima_pred),
            "mae": mae(arima_true, arima_pred),
            "per_horizon": per_horizon_metrics(arima_true, arima_pred),
            "rows": int(arima_true.shape[0]),
        }
    else:
        summary["arima"] = {"skipped": True, "reason": "statsmodels missing or insufficient data"}

    # LSTM ---------------------------------------------------------------
    try:
        model, scaler, bundle = load_trained_lstm(disease, cfg)
        lstm_pred = predict_lstm(
            model, scaler, X_te, bundle.get("target_transform", "log1p"), groups=g_te
        )
        summary["lstm"] = {
            "mape": mape(y_te, lstm_pred),
            "rmse": rmse(y_te, lstm_pred),
            "mae": mae(y_te, lstm_pred),
            "per_horizon": per_horizon_metrics(y_te, lstm_pred),
        }
    except FileNotFoundError:
        summary["lstm"] = {"skipped": True, "reason": "Run train.py first"}

    # Save baselines artifact
    cfg.artifacts_dir.mkdir(parents=True, exist_ok=True)
    out_path = cfg.artifacts_dir / f"{disease.lower()}_baselines.json"
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"[{disease}] baselines saved -> {out_path}")
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate baselines vs LSTM")
    parser.add_argument("--disease", default="ILI", help="ILI | DENGUE | AWD | all")
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.yaml")))
    parser.add_argument("--data", default=None)
    args = parser.parse_args(argv)

    cfg = load_config(Path(args.config), overrides={})
    if args.data:
        cfg.data_csv = Path(args.data)
    set_seed(cfg.seed)

    df = pd.read_csv(cfg.data_csv)
    targets = (
        ["ILI", "DENGUE", "AWD"] if args.disease.lower() == "all" else [args.disease.upper()]
    )
    for disease in targets:
        evaluate_disease(disease, df, cfg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
