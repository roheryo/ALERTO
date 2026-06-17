"""FastAPI LSTM inference service (PyTorch).

    uvicorn serve.main:app --host 127.0.0.1 --port 5000

Endpoints
---------
GET  /health                       liveness probe
GET  /metrics                      training metrics for all available diseases
POST /predict                      1..4 week forecast for one (municipality, disease)
GET  /predict?municipality_id=&disease=   convenience wrapper around POST
"""
from __future__ import annotations

import json
import sys
from datetime import timedelta
from pathlib import Path
from typing import Dict, List

import joblib
import numpy as np
import pandas as pd
import torch
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml"))

from model_lstm import CaseLSTM  # noqa: E402

ARTIFACTS = ROOT / "ml" / "artifacts"
DATA_CSV = ROOT / "data" / "processed" / "surveillance_weekly_training.csv"

app = FastAPI(title="ALERTO LSTM", version="0.3.0")

# Loaded model bundles keyed by lowercase disease code.
_cache: Dict[str, dict] = {}


class PredictBody(BaseModel):
    municipality_id: int
    disease: str = "ILI"


# --------------------------------------------------------------------------- #
# Bundle loading + inference helpers
# --------------------------------------------------------------------------- #

def _load_bundle(disease: str) -> dict:
    key = disease.lower()
    if key in _cache:
        return _cache[key]

    stem = key
    pt = ARTIFACTS / f"{stem}_lstm.pt"
    sc = ARTIFACTS / f"{stem}_scaler.joblib"
    cfg = ARTIFACTS / f"{stem}_config.json"
    if not (pt.is_file() and sc.is_file() and cfg.is_file()):
        raise HTTPException(
            status_code=404,
            detail=f"No trained artifacts for disease={disease!r}. Run train.py first.",
        )

    bundle = json.loads(cfg.read_text(encoding="utf-8"))
    state = torch.load(pt, map_location="cpu", weights_only=True)
    model = CaseLSTM(
        n_features=len(bundle["feature_columns"]),
        hidden=int(bundle.get("hidden", 64)),
        dropout=float(bundle.get("dropout", 0.2)),
        horizon=int(bundle["horizon_weeks"]),
    )
    model.load_state_dict(state)
    model.eval()

    bundle["model"] = model
    bundle["scaler"] = joblib.load(sc)
    bundle["disease"] = disease.upper()
    _cache[key] = bundle
    return bundle


def _series_for_muni(municipality_id: int, disease: str) -> pd.DataFrame:
    if not DATA_CSV.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"Training CSV not found at {DATA_CSV}. Build the dataset first.",
        )
    df = pd.read_csv(DATA_CSV)
    sub = df[
        (df["municipality_id"] == municipality_id)
        & (df["disease_code"].str.upper() == disease.upper())
    ].copy()
    if sub.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No surveillance rows for municipality_id={municipality_id}, disease={disease}",
        )
    return sub.sort_values("week_start").reset_index(drop=True)


def _predict(municipality_id: int, disease: str) -> dict:
    bundle = _load_bundle(disease)
    series = _series_for_muni(municipality_id, disease)

    lookback = int(bundle["lookback_weeks"])
    horizon = int(bundle["horizon_weeks"])
    feature_cols: List[str] = list(bundle["feature_columns"])
    transform = bundle.get("target_transform", "log1p")

    if len(series) < lookback:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {lookback} weeks of history; got {len(series)}.",
        )

    window = series.tail(lookback)
    last_week = pd.to_datetime(window.iloc[-1]["week_start"])

    feats = (
        window[feature_cols]
        .apply(pd.to_numeric, errors="coerce")
        .fillna(0.0)
        .to_numpy(dtype=np.float32)
    )
    if feats.shape != (lookback, len(feature_cols)) or np.isnan(feats).any():
        raise HTTPException(status_code=500, detail="Invalid feature window")

    scaled = bundle["scaler"].transform(feats.reshape(-1, len(feature_cols)))
    scaled = scaled.reshape(1, lookback, len(feature_cols)).astype(np.float32)

    with torch.no_grad():
        raw = bundle["model"](torch.from_numpy(scaled)).cpu().numpy().squeeze(0)
    if transform == "log1p":
        raw = np.expm1(raw)
    raw = np.clip(np.round(raw), 0, None)

    forecast = []
    for step in range(horizon):
        target_week = (last_week + timedelta(weeks=step + 1)).date().isoformat()
        forecast.append(
            {
                "step": step + 1,
                "week_start": target_week,
                "predicted_cases": int(raw[step]),
            }
        )

    return {
        "municipality_id": municipality_id,
        "disease": disease.upper(),
        "lookback_weeks": lookback,
        "horizon_weeks": horizon,
        "as_of_week": last_week.date().isoformat(),
        "forecast": forecast,
    }


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #

@app.get("/health")
def health() -> dict:
    available = sorted(
        p.stem.replace("_lstm", "").upper()
        for p in ARTIFACTS.glob("*_lstm.pt")
    )
    return {
        "ok": True,
        "service": "ALERTO LSTM",
        "version": app.version,
        "artifacts_dir": str(ARTIFACTS),
        "diseases_available": available,
    }


@app.get("/metrics")
def metrics() -> dict:
    out: Dict[str, dict] = {}
    for p in sorted(ARTIFACTS.glob("*_metrics.json")):
        key = p.stem.replace("_metrics", "")
        try:
            out[key] = json.loads(p.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover
            out[key] = {"error": str(exc)}
    return out


@app.post("/predict")
def predict_post(body: PredictBody) -> dict:
    return _predict(body.municipality_id, body.disease)


@app.get("/predict")
def predict_get(
    municipality_id: int = Query(..., ge=1),
    disease: str = Query("ILI"),
) -> dict:
    return _predict(municipality_id, disease)
