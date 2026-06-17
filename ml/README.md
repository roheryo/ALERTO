# ALERTO LSTM (Dengue / ILI / AWD)

Predictive layer for the ALERTO surveillance platform. Implements the
**Long Short-Term Memory (LSTM)** forecaster described in Chapter 2 of the
manuscript (*"Alerto: A Predictive Public Health Surveillance System for
Dengue, ILI, and AWD Using Recurrent Neural Network"*).

> Decision-support only. Outputs are statistical probabilities for 1–4 week
> case-count trajectories at the **municipality × disease** level — they are
> **not** a substitute for clinical diagnostics or formal outbreak declarations.

## Layout

```
ml/
├── model_lstm.py            CaseLSTM (stacked LSTM + dropout + linear head)
├── config.yaml              Lookback, horizon, features, hyperparameters
├── train.py                 Sequence builder + training loop
├── evaluate_baselines.py    Naive, Ridge, SVR, ARIMA vs LSTM (thesis §2.5)
├── serve/
│   └── main.py              FastAPI inference service (/health /metrics /predict)
├── artifacts/               Generated per disease (gitignored)
│   ├── ili_lstm.pt
│   ├── ili_scaler.joblib
│   ├── ili_config.json
│   ├── ili_metrics.json
│   └── ili_baselines.json
└── requirements.txt
```

## Setup (one-time)

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## npm shortcuts (run from repo root)

| Script | What it does |
|---|---|
| `npm run dev` | Kills :3001 / :5050, then runs **frontend + Express API + FastAPI LSTM** together with coloured logs. Ctrl+C stops all three. |
| `npm run dev:no-ml` | Frontend + Express API only (skip the LSTM service). |
| `npm run ml:serve` | Just the FastAPI LSTM service on :5050. |
| `npm run ml:health` | Curl-equivalent of `GET /health` against :5050. |
| `npm run ml:train` | Train all three LSTMs from the current CSV. |
| `npm run ml:eval` | Re-run all baselines + print the thesis-style comparison table. |
| `npm run ml:fetch-weather` | Pull Open-Meteo ERA5 history into `data/processed/weather_daily.csv`. |
| `npm run ml:build-dataset` | Rebuild `surveillance_weekly_training.csv` from MySQL + weather. |
| `npm run ml:synth` | Insert balanced synthetic confirmed cases (Dengue/ILI/AWD) with disease-correlated weather + environment factors. See `Synthetic dataset` below. |
| `npm run ml:synth:dry` | Plan-only run; prints per-disease / per-municipality / per-barangay totals without touching MySQL. |
| `npm run ml:synth:reset` | Delete all prior `SYN-*` rows then regenerate. |
| `npm run ml:rebuild` | Full chain: fetch-weather → build-dataset → train → eval. |
| `npm run ml:rebuild:synthetic` | fetch-weather → **synth:reset** → build-dataset → train → eval. Use this until BHU form adoption catches up. |

## Train

Uses `data/processed/surveillance_weekly_training.csv` (11 municipalities ×
3 diseases × ~173 weeks). Splits are read from the CSV's `split` column
(70/15/15, time-ordered — see thesis §2.3.3).

```powershell
# Single disease
python ml/train.py --disease ILI
python ml/train.py --disease DENGUE
python ml/train.py --disease AWD

# All three sequentially
python ml/train.py --disease all

# Override hyperparameters
python ml/train.py --disease ILI --epochs 150 --hidden 96
```

Each run writes four files into `ml/artifacts/`:

| File | Purpose |
|------|---------|
| `{disease}_lstm.pt` | PyTorch `state_dict` for `CaseLSTM` |
| `{disease}_scaler.joblib` | `StandardScaler` fitted on train features only |
| `{disease}_config.json` | Feature/target columns, lookback, horizon, transform |
| `{disease}_metrics.json` | Train/val/test counts + MAPE/RMSE/MAE (overall + per horizon step) |

## Benchmark (thesis §2.5)

After training, generate the comparison table required by your evaluation
chapter:

```powershell
python ml/evaluate_baselines.py --disease ILI
python ml/evaluate_baselines.py --disease all
```

This produces `{disease}_baselines.json` containing MAPE / RMSE / MAE for:

- **Naive persistence** — repeat last observed week
- **Ridge regression** — linear baseline on flattened window
- **SVR (RBF)** — one model per horizon step
- **ARIMA** — per-municipality univariate (skipped if `statsmodels` missing)
- **LSTM** — loaded from `{disease}_lstm.pt`

Use `per_horizon` to report error at +1, +2, +3, +4 weeks separately.

## Serve

```powershell
cd ml
.\.venv\Scripts\activate
uvicorn serve.main:app --host 127.0.0.1 --port 5050
```

> **Port note (Windows):** On some Windows machines port `5000` is held by the
> "AI Foundry" / "AppContainer" loopback service. We default to `5050` and set
> `ML_SERVICE_URL=http://127.0.0.1:5050` in `backend/.env` to match.

Endpoints (consumed by the Express backend via `/api/forecasts`):

| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| `GET`  | `/health` | — | `{ ok, version, diseases_available }` |
| `GET`  | `/metrics` | — | Map of `disease → metrics.json` contents |
| `POST` | `/predict` | `{ municipality_id, disease }` | 4-week forecast |
| `GET`  | `/predict?municipality_id=…&disease=…` | — | Same as POST (handy for browser) |

Example response:

```json
{
  "municipality_id": 6,
  "disease": "DENGUE",
  "lookback_weeks": 12,
  "horizon_weeks": 4,
  "as_of_week": "2026-05-10",
  "forecast": [
    { "step": 1, "week_start": "2026-05-17", "predicted_cases": 4 },
    { "step": 2, "week_start": "2026-05-24", "predicted_cases": 5 },
    { "step": 3, "week_start": "2026-05-31", "predicted_cases": 6 },
    { "step": 4, "week_start": "2026-06-07", "predicted_cases": 6 }
  ]
}
```

## Model spec (matches thesis §2.4.1)

```
Input  [batch, 12 weeks, 18 features]
   │
   ▼
LSTM(hidden=64)                  ◄── "memory" + forget gates
   │
Dropout(0.2)
   │
   ▼
LSTM(hidden=64)
   │
   ▼
Linear(64 → 4)                   ◄── outputs cases at t+1..t+4
```

- **Target transform:** `log1p` on case counts (stabilises sparse / zero weeks
  common in AWD); inverse `expm1` applied at inference time.
- **Loss:** MSE on log-space targets.
- **Optimiser:** Adam (`lr=1e-3`).
- **Early stopping:** patience 20 epochs on validation loss.

## Features used at each timestep

From `data/processed/surveillance_weekly_training.csv` (18 columns, order
matters — preserved in each `{disease}_config.json`):

| Group | Feature | Captures |
|-------|---------|----------|
| Surveillance | `case_count`, `cases_rolling_4wk`, `cases_rolling_8wk` | Recent morbidity trend |
| Seasonality  | `week_sin`, `week_cos`, `month` | Tropical seasonality (no winter peak) |
| Meteorology  | `temp_mean_c`, `humidity_mean_pct`, `rainfall_sum_mm` | Current climate |
| Meteorology  | `rainfall_sum_mm_lag_4`, `rainfall_sum_mm_lag_6` | Lagged rainfall → mosquito breeding / WASH stress |
| Environmental | `pct_stagnant_water_4wk`, `pct_recent_heavy_rain_4wk`, `pct_indoor_crowding_4wk` | Dengue / ILI vector + transmission risk reported by BHU |
| WASH         | `pct_unimproved_water_4wk`, `pct_open_defecation_4wk` | AWD primary risk drivers |
| Hydro flags  | `pct_flood_history_4wk`, `pct_drought_history_4wk` | Acute water-quality stress |

The environmental / WASH features are computed in
`backend/scripts/build-ml-datasets.mjs` from per-case rows in the
`case_environment` MySQL table (populated by `ReportCaseForm.jsx` → `/api/patients`).
They are 4-week rolling rates per `(municipality_id, ISO-week)`, shared across
all three diseases for the same location.

Raw (non-rolling) versions are also written to the CSV
(`pct_stagnant_water`, `env_reports`, etc.) but are **not** in the default
feature set because they are too noisy when only one or two cases reported per
week — only add them to `config.yaml::feature_columns` once your BHU adoption
yields more reports per week.

## Dataset prerequisites

`data/processed/surveillance_weekly_training.csv` must exist. Regenerate it
from the live database with:

```powershell
node backend/scripts/build-ml-datasets.mjs        # form-only (default)
node backend/scripts/fetch-weather-history.mjs
```

Columns expected per row: `municipality_id`, `municipality_name`,
`disease_code` (`ILI` | `DENGUE` | `AWD`), `week_start`, the feature columns
listed in `config.yaml`, `cases_t_plus_1..4`, and a `split` column with values
`train` / `val` / `test`.

### Source-of-truth policy

The build script accepts a row for training **only** when both of the
following hold:

1. `patients.case_classification = 'Confirmed'` — diagnostic certainty.
2. `patients.created_by IS NOT NULL` — the row was submitted through the BHU
   `ReportCaseForm.jsx` → `POST /api/patients` path (not bulk-imported from
   the 2023 Excel sheet or seeded as sample data).

The line-list CSV's `source` column records `form` vs `imported` for every
row to make the policy auditable for the thesis defense.

Why this matters: the form is the system of record going forward, and only
cases captured through it carry the per-case environmental factors
(`stagnant_water`, `wash_water_source`, …) that drive the new environmental
LSTM features. Training on rows from other sources would teach the model on
data the live pipeline can no longer reproduce.

If you need to sanity-check the pipeline against the historical ILI 2023
dataset (for example to populate the thesis benchmark before BHU adoption is
complete), pass the escape hatch:

```powershell
npm run ml:build-dataset:imported   # adds --include-imported
npm run ml:rebuild:imported         # full chain with imported rows
```

The escape hatch still requires `case_classification = 'Confirmed'`; it only
relaxes rule (2).

The script will log
`source policy: confirmed = YES, form-submitted only = YES/NO` on every run
so the source of the CSV is unambiguous, and warns when the eligible set
falls below 50 cases.

## Synthetic dataset (`backend/scripts/generate-synthetic-cases.mjs`)

Until enough live BHU form submissions accumulate, the LSTM has too many
zero-case weeks to learn meaningful dynamics. The synth script builds a
**balanced, climate-correlated, fully audited** training corpus by inserting
patient + `case_environmental` rows directly into MySQL.

### Statistical model

For each `(municipality, ISO week, disease)` the script computes an expected
weekly case count as

```
λ = λ_base × exp( β · z(weather features) ) × seasonal_multiplier(disease, month) × muni_vulnerability
case_count ~ NegativeBinomial(mean = λ, dispersion = 5)
```

Coefficients per disease (mirrors thesis §2.4.3 literature review):

| Disease | Driver weights (z-scored weekly weather) |
|---------|-------------------------------------------|
| Dengue  | +0.55 rainfall (lag 4w) +0.40 rainfall (lag 6w) +0.30 humidity +0.10 temp |
| ILI     | +0.30 humidity − 0.25 temp                |
| AWD     | +0.55 rainfall (current) +0.25 rainfall (lag 4w) +0.10 humidity |

Seasonal multipliers (per calendar month, tropical climate) follow DOH-style
bulletins — dengue peaks Jul–Nov, AWD tracks rainfall, ILI has a soft cool /
crowded-season peak.

### Per-case environmental fields

Each generated patient gets a `case_environmental` row whose probabilities are
conditioned on **both the disease AND that week's actual weather**, e.g.:

- AWD case during a heavy-rain week → `recent_heavy_rain=1` w.p. 0.80, `flood_history_4wk=1` w.p. 0.55, `wash_water_source ∈ {unimproved, none}` w.p. ~0.55.
- Dengue case during a heavy-rain week → `stagnant_water=1` w.p. 0.78.
- ILI case during a humid week → `indoor_crowding=1` w.p. 0.70.

Each **barangay** also gets a fixed structural WASH baseline (some barangays
are consistently worse on water/sanitation across all weeks/diseases), so the
4-week rolling rates the LSTM sees vary realistically between locations.

### Geographic distribution

Within a municipality, weekly cases are scattered across barangays via a
Dirichlet split weighted by each barangay's disease-specific vulnerability.
Every barangay receives a non-zero share over the ~173-week window, so the
training CSV is well-distributed.

### Auditing

All synthetic patients carry `patient_number LIKE 'SYN-<DISEASE>-<seq>'` and a
real BHU user as `created_by`. This means they:

1. Satisfy the default `case_classification = 'Confirmed' AND created_by IS NOT NULL` filter in `build-ml-datasets.mjs`.
2. Are trivially separable from real submissions by SQL: `WHERE patient_number LIKE 'SYN-%'`.
3. Are purged in one call: `npm run ml:synth:reset` (cascades to `case_environmental` via FK).

### Usage

```powershell
# Plan only, no DB writes (default 6000 cases / disease across all munis)
npm run ml:synth:dry

# Insert 6000 cases per disease (default)
npm run ml:synth

# Wipe prior synthetic rows then insert
npm run ml:synth:reset

# Custom: balanced 4000/disease, deterministic seed
node backend/scripts/generate-synthetic-cases.mjs --target-per-disease 4000 --seed 7

# Full chain: regenerate from scratch and retrain
npm run ml:rebuild:synthetic
```

The script also writes `data/processed/synthetic_case_summary.csv` with the
per-barangay totals per disease, which is handy as a defense exhibit.
