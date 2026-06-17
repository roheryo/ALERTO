# Database migrations

Run scripts in numeric order on a fresh MySQL instance:

| File | Purpose |
|------|---------|
| `00_create_database.sql` | Create `ALERTO` database |
| `01_schema.sql` | Tables and indexes |
| `02_seed_geography.sql` | Provinces, municipalities, barangays |
| `03_seed_users.sql` | Demo accounts |
| `04_seed_sample_patients.sql` | Optional sample cases |
| `05_example_queries_for_api.sql` | Reference queries |
| `06_fix_password_hash_bcryptjs.sql` | Password hash fix (existing DBs) |
| `07_patch_barangays_geography.sql` | Geography corrections |
| `08_patients_case_fields.sql` | Case classification columns |
| `09_patients_patient_number.sql` | Patient number column |
| `10_users_username_from_fullname.sql` | Usernames derived from full name / place (existing DBs) |
| `14_case_environmental.sql` | Per-case environmental / WASH factors (drives new LSTM features) |
| `15_early_warning_alerts.sql` | Early-Warning alerts + lifecycle audit log (server-generated outbreak-risk signals per barangay × disease) |

> Migrations `11`–`13` previously created an earlier `early_warning_alerts`
> table. That module was retired and those files removed. The Early-Warning
> system has since been **redesigned** in `15_early_warning_alerts.sql` with a
> dedup-friendly schema, a JSON trigger snapshot, an explicit status lifecycle,
> and an events audit log. If you have an older DB with the legacy tables, drop
> them before running migration 15 so the new schema is created cleanly:
>
> ```sql
> DROP TABLE IF EXISTS early_warning_alert_events;
> DROP TABLE IF EXISTS early_warning_alerts;
> ```
>
> The backend also auto-creates these tables on startup
> (`backend/bootstrap/schema.js` → `ensureEarlyWarningAlertTables`), so existing
> databases pick them up without running the migration manually.

## ILI 2023 dataset (Excel import)

Place `ILI-2023.xlsx` in `database/imports/` (included from provincial ILI 2023 surveillance export).

From repo root (MySQL running, `backend/.env` configured):

```bash
npm run import:surveillance --prefix backend   # ILI 2023 + Dengue CSV
npm run import:ili-2023:dry --prefix backend   # preview ILI counts
npm run import:ili-2023 --prefix backend      # load ~1,433 ILI rows
npm run import:dengue:dry --prefix backend     # preview Dengue counts
npm run import:dengue --prefix backend         # load ~1,975 Dengue rows
```

Place source files in `database/imports/` (`ILI-2023.xlsx`, `DAVAO DE ORO DENGUE DATA.csv`) or pass `--file`.

Re-running replaces rows whose `patient_number` starts with `ILI23-` or `DEN-`. Use `--no-replace` to append without deleting prior import.

Example:

```bash
mysql -u root -p < database/migrations/00_create_database.sql
mysql -u root -p ALERTO < database/migrations/01_schema.sql
```
