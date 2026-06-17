"""Lightweight weekly scheduler for ALERTO automated retraining.

Runs as its own long-lived process (separate from the FastAPI forecasting
service) and triggers ``ml/retrain.py`` once a week. Because retraining is
launched as a *subprocess*, a failed or slow run never blocks or interrupts the
live ``/predict`` service — the orchestrator stages into a version directory and
only hot-swaps the active model on success.

Pure standard library — no extra dependencies.

Usage
-----
    python ml/scheduler.py                       # Monday 02:00 local, weekly
    python ml/scheduler.py --day sun --time 23:30
    python ml/scheduler.py --run-now             # run once immediately, then loop
    python ml/scheduler.py --interval-days 7     # fixed-interval instead of weekday

For a managed alternative, wire ``python ml/retrain.py`` into cron
(Linux/macOS) or Windows Task Scheduler instead of running this loop — see
ml/README.md (§ Automated weekly retraining).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:
        pass

ROOT = Path(__file__).resolve().parents[1]
RETRAIN_SCRIPT = Path(__file__).with_name("retrain.py")

WEEKDAYS = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
}


def _python_exe() -> str:
    """Prefer the project venv interpreter; fall back to the current one."""
    venv = ROOT / "ml" / ".venv" / "Scripts" / "python.exe"
    if venv.is_file():
        return str(venv)
    venv_posix = ROOT / "ml" / ".venv" / "bin" / "python"
    if venv_posix.is_file():
        return str(venv_posix)
    return sys.executable


def _next_weekday_run(now: datetime, weekday: int, hour: int, minute: int) -> datetime:
    """Next occurrence of `weekday` at hh:mm, strictly in the future."""
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    days_ahead = (weekday - now.weekday()) % 7
    target += timedelta(days=days_ahead)
    if target <= now:
        target += timedelta(days=7)
    return target


def run_retrain(extra_args: list[str]) -> int:
    cmd = [_python_exe(), str(RETRAIN_SCRIPT), *extra_args]
    print(f"[scheduler] {datetime.now().isoformat(timespec='seconds')} "
          f"launching: {' '.join(cmd)}", flush=True)
    # Separate subprocess: isolates retraining from this loop and from serving.
    result = subprocess.run(cmd, cwd=str(ROOT))
    print(f"[scheduler] retrain finished with exit code {result.returncode}", flush=True)
    return result.returncode


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="ALERTO weekly retraining scheduler")
    p.add_argument("--day", default="mon", choices=sorted(WEEKDAYS),
                   help="Weekday to retrain on (default: mon).")
    p.add_argument("--time", default="02:00", help="HH:MM local time (default 02:00).")
    p.add_argument("--interval-days", type=int, default=None,
                   help="Use a fixed interval (days) instead of a fixed weekday.")
    p.add_argument("--run-now", action="store_true",
                   help="Run one retrain immediately on startup, then schedule.")
    p.add_argument("--retrain-args", default="",
                   help="Extra args forwarded verbatim to retrain.py, e.g. "
                        "\"--max-mape-degradation 0.05\".")
    args = p.parse_args(argv)

    try:
        hour, minute = (int(x) for x in args.time.split(":", 1))
    except ValueError:
        print(f"[scheduler] Invalid --time {args.time!r}; expected HH:MM", file=sys.stderr)
        return 2

    extra = args.retrain_args.split() if args.retrain_args else []
    weekday = WEEKDAYS[args.day]

    print(f"[scheduler] Started. python={_python_exe()}", flush=True)
    if args.interval_days:
        print(f"[scheduler] Mode: every {args.interval_days} day(s).", flush=True)
    else:
        print(f"[scheduler] Mode: weekly on {args.day} at {args.time} local.", flush=True)

    if args.run_now:
        run_retrain(extra)

    while True:
        now = datetime.now()
        if args.interval_days:
            next_run = now + timedelta(days=args.interval_days)
            next_run = next_run.replace(hour=hour, minute=minute, second=0, microsecond=0)
        else:
            next_run = _next_weekday_run(now, weekday, hour, minute)

        sleep_seconds = max(1, int((next_run - now).total_seconds()))
        print(f"[scheduler] Next retrain at {next_run.isoformat(timespec='seconds')} "
              f"(in {sleep_seconds // 3600}h {sleep_seconds % 3600 // 60}m).", flush=True)

        # Sleep in chunks so the process responds to Ctrl+C promptly.
        slept = 0
        while slept < sleep_seconds:
            chunk = min(60, sleep_seconds - slept)
            time.sleep(chunk)
            slept += chunk

        run_retrain(extra)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[scheduler] Stopped.", flush=True)
        raise SystemExit(0)
