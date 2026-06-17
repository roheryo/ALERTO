"""Pretty-print baseline benchmark JSON for thesis tables."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "ml" / "artifacts"


def main() -> int:
    for disease in ("ili", "dengue", "awd"):
        path = ART / f"{disease}_baselines.json"
        if not path.is_file():
            print(f"-- {disease.upper()}: missing artifact")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        print(f"=== {disease.upper()} (test_rows={data.get('test_rows')}) ===")
        for model in ("naive", "ridge", "svr", "arima", "lstm"):
            entry = data.get(model, {})
            if entry.get("skipped"):
                print(f"  {model:6s} skipped ({entry.get('reason')})")
                continue
            mape = entry.get("mape")
            rmse = entry.get("rmse")
            mae = entry.get("mae")
            if mape is None:
                print(f"  {model:6s} (no data)")
            else:
                print(f"  {model:6s} MAPE={mape:.4f}  RMSE={rmse:.4f}  MAE={mae:.4f}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
