# Data imports

| File | Description |
|------|-------------|
| `ILI-2023.xlsx` | Provincial ILI surveillance export (2023), sheet `ILI` (~1,433 case rows) |
| `DAVAO DE ORO DENGUE DATA.csv` | Provincial dengue line list (~1,975 unique Davao de Oro cases after dedupe) |

Load into MySQL with:

```bash
npm run import:surveillance --prefix backend   # ILI + Dengue
npm run import:ili-2023 --prefix backend
npm run import:dengue --prefix backend
```

Imported cases use `patient_number` prefixes `ILI23-` and `DEN-`, disease types `Influenza-like illness (ILI)` and `Dengue`, and map to `municipalities` / `barangays` in Davao de Oro.
