"""Quick sanity check for surveillance_weekly_training.csv."""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "processed" / "surveillance_weekly_training.csv"


def main() -> int:
    df = pd.read_csv(CSV)
    print(f"rows={len(df):,}  columns={len(df.columns)}")
    print(f"diseases: {sorted(df['disease_code'].unique().tolist())}")
    print(f"municipalities: {df['municipality_id'].nunique()}")
    print(f"date range: {df['week_start'].min()} -> {df['week_start'].max()}")
    print(f"splits: {df['split'].value_counts().to_dict()}")
    weather_cols = [
        c for c in df.columns if any(k in c for k in ("temp_", "humidity_", "rainfall_"))
    ]
    populated = (
        df[weather_cols]
        .notna()
        .mean()
        .sort_values(ascending=False)
        .head(8)
        .round(3)
        .to_dict()
    )
    print(f"weather populated %:")
    for col, pct in populated.items():
        print(f"  {col:32s} {pct:.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
