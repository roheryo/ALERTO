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

Example:

```bash
mysql -u root -p < database/migrations/00_create_database.sql
mysql -u root -p ALERTO < database/migrations/01_schema.sql
```
