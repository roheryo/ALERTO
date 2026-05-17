# Data imports

| File | Description |
|------|-------------|
| `ILI-2023.xlsx` | Provincial ILI surveillance export (2023), sheet `ILI` (~1,433 case rows) |

Load into MySQL with:

```bash
npm run import:ili-2023 --prefix backend
```

Imported cases use `patient_number` prefix `ILI23-`, disease type `Influenza-like illness (ILI)`, and map to `municipalities` / `barangays` in Davao de Oro.
