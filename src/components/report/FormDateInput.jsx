import { useEffect, useId, useMemo, useRef, useState } from "react";

import "./FormDateInput.css";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MDY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isoFromParts(year, monthIndex, day) {
  const y = String(year);
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoFromDate(d) {
  return isoFromParts(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parse typed value to YYYY-MM-DD, or "" when empty, or null when invalid. */
function parseDateInput(text) {
  const t = String(text ?? "").trim();
  if (!t) return "";

  const iso = t.match(ISO_RE);
  if (iso) {
    const candidate = `${iso[1]}-${iso[2]}-${iso[3]}`;
    const d = new Date(`${candidate}T12:00:00`);
    if (!Number.isNaN(d.getTime()) && isoFromDate(d) === candidate) return candidate;
  }

  const mdy = t.match(MDY_RE);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    const d = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === year &&
      d.getMonth() === month - 1 &&
      d.getDate() === day
    ) {
      return isoFromDate(d);
    }
  }

  return null;
}

function viewFromIso(iso) {
  if (iso && parseDateInput(iso)) {
    const d = new Date(`${iso}T12:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function buildCalendarCells(year, month) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrev - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ iso: isoFromParts(prevYear, prevMonth, day), day, outside: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: isoFromParts(year, month, day), day, outside: false });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ iso: isoFromParts(nextYear, nextMonth, nextDay), day: nextDay, outside: true });
    nextDay += 1;
  }

  return cells;
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function isWithinBounds(iso, min, max) {
  if (!iso) return true;
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

/**
 * Date field: type YYYY-MM-DD (or MM/DD/YYYY on blur) or pick from calendar popover.
 * @param {{ id: string, value?: string, onChange: (isoYmd: string) => void, error?: boolean, disabled?: boolean, min?: string, max?: string }} props
 */
export default function FormDateInput({
  id,
  value = "",
  onChange,
  error = false,
  disabled = false,
  min = "",
  max = ""
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => viewFromIso(value));
  const wrapRef = useRef(null);
  const popoverId = useId();

  const displayText = editing ? draft : value || "";

  useEffect(() => {
    if (!open || disabled) return undefined;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, disabled]);

  const cells = useMemo(() => buildCalendarCells(view.year, view.month), [view.year, view.month]);

  const commitText = () => {
    setEditing(false);
    if (!draft.trim()) {
      onChange("");
      return;
    }
    const iso = parseDateInput(draft);
    if (iso != null && isWithinBounds(iso, min, max)) {
      onChange(iso);
      setView(viewFromIso(iso));
    }
  };

  const shiftMonth = (delta) => {
    setView((v) => {
      const next = new Date(v.year, v.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const selectDay = (iso) => {
    if (!isWithinBounds(iso, min, max)) return;
    setEditing(false);
    onChange(iso);
    setView(viewFromIso(iso));
    setOpen(false);
  };

  const openCalendar = () => {
    if (disabled) return;
    setView(viewFromIso(value));
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="form-date-field" ref={wrapRef}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`form-input form-date-text${error ? " error" : ""}`}
        placeholder="YYYY-MM-DD or MM/DD/YYYY"
        value={displayText}
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setEditing(true);
          setDraft(value || "");
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText();
          }
        }}
        aria-invalid={error || undefined}
        aria-describedby={open ? popoverId : undefined}
      />
      <button
        type="button"
        className="form-date-trigger"
        aria-label="Open calendar"
        aria-expanded={open}
        aria-controls={popoverId}
        disabled={disabled}
        onClick={openCalendar}
      >
        <IconCalendar />
      </button>
      {open ? (
        <div id={popoverId} className="form-date-popover" role="dialog" aria-label="Choose date">
          <div className="form-date-popover-head">
            <button type="button" className="form-date-nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <div className="form-date-popover-title">
              {MONTH_NAMES[view.month]} {view.year}
            </div>
            <button type="button" className="form-date-nav" aria-label="Next month" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>
          <div className="form-date-weekdays" aria-hidden>
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="form-date-weekday">
                {wd}
              </span>
            ))}
          </div>
          <div className="form-date-grid" role="grid">
            {cells.map((cell) => {
              const outOfRange = !isWithinBounds(cell.iso, min, max);
              return (
              <button
                key={cell.iso}
                type="button"
                role="gridcell"
                disabled={outOfRange}
                className={`form-date-day${cell.outside ? " outside" : ""}${cell.iso === value ? " selected" : ""}`}
                onClick={() => selectDay(cell.iso)}
              >
                {cell.day}
              </button>
            );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
