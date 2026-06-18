# ALERTO

Disease surveillance web app for Davao de Oro — React (Vite) frontend, Express API, and MySQL.

## Project structure

```
ALERTO/
├── backend/                 # Express API (port 3001)
│   ├── bootstrap/           # Idempotent schema helpers on startup
│   ├── config/              # DB pool
│   ├── middleware/          # JWT auth
│   ├── routes/              # Route modules (e.g. weather)
│   ├── services/            # Weather proxy (OpenWeather / Open-Meteo)
│   ├── server.js            # API entry + core routes
│   ├── .env.example         # Copy to .env (never commit .env)
│   └── package.json
├── database/
│   └── migrations/          # Numbered SQL — run in order (00 → 09)
├── public/                  # Static assets (favicon, icons)
├── scripts/
│   └── dev/                 # Local dev utilities
├── src/                     # React frontend
│   ├── assets/images/       # Logos and images
│   ├── components/
│   │   ├── auth/            # ProtectedRoute, RoleRoute
│   │   ├── common/          # Shared UI (e.g. logout modal)
│   │   ├── report/          # Report case wizard
│   │   └── weather/         # Live weather card
│   ├── context/             # Auth state
│   ├── data/                # Geography reference data
│   ├── hooks/               # usePatients, useAccountWeather
│   ├── layout/              # Dashboard shell + sidebar
│   ├── lib/                 # API client, disease helpers, weather client
│   ├── pages/               # Route screens (by feature)
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── cases/
│   │   ├── dashboard/
│   │   ├── patients/
│   │   └── reports/
│   └── styles/              # Global + dashboard shell CSS
├── package.json             # Frontend + dev orchestration
└── vite.config.js
```

## Setup

### 1. Database

Create the database and run migrations in order:

```bash
mysql -u root -p < database/migrations/00_create_database.sql
mysql -u root -p ALERTO < database/migrations/01_schema.sql
# … continue through 09 as needed for your environment
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # set DB_PASS, JWT_SECRET, optional OPENWEATHER_API_KEY
npm install
npm run dev
```

### 3. Frontend

From the repo root:

```bash
npm install
npm run dev
```

`npm run dev` starts the API and Vite together (API on `http://localhost:3001`, UI on Vite’s port with `/api` proxied).

## Environment

| Variable | Location | Purpose |
|----------|----------|---------|
| `DB_*`, `JWT_SECRET`, `PORT` | `backend/.env` | MySQL + auth |
| `OPENWEATHER_API_KEY` | `backend/.env` | Optional; falls back to Open-Meteo |
| `WEATHER_CACHE_TTL_MS` | `backend/.env` | Weather cache (default 10 min) |

Never commit `backend/.env`.
