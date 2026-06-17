import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { useDecisionBrief, useDeclarations } from "@/hooks/useDeclarations";
import { computeRiskScore } from "@/lib/riskScoring";
import { thresholdForDisease } from "@/lib/riskConfig";

const SEVERITY_META = {
  high: { label: "High risk", color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  elevated: { label: "Elevated", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  watch: { label: "Watch", color: "#ca8a04", bg: "rgba(202,138,4,0.12)" },
  normal: { label: "Normal", color: "#16a34a", bg: "rgba(22,163,74,0.12)" }
};

function severityMeta(severity) {
  return SEVERITY_META[severity] ?? SEVERITY_META.normal;
}

function RiskGauge({ risk }) {
  const meta = severityMeta(risk.severity);
  return (
    <div className="muni-declare-risk">
      <div className="muni-declare-risk-head">
        <div className="muni-declare-risk-score" style={{ color: meta.color }}>
          {risk.score}
          <span className="muni-declare-risk-max">/100</span>
        </div>
        <span
          className="muni-declare-risk-pill"
          style={{ color: meta.color, background: meta.bg }}
        >
          {meta.label}
        </span>
      </div>
      <div className="muni-declare-risk-track" aria-hidden="true">
        <div
          className="muni-declare-risk-fill"
          style={{ width: `${Math.min(100, risk.score)}%`, background: meta.color }}
        />
      </div>
      <ul className="muni-declare-factors">
        {risk.factors.map((f) => (
          <li key={f.key}>
            <div className="muni-declare-factor-row">
              <span className="muni-declare-factor-label">{f.label}</span>
              <span className="muni-declare-factor-points">{f.points} pts</span>
            </div>
            <span className="muni-declare-factor-detail">{f.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Declaration workspace — decision-support panel for a barangay selected from
 * the velocity table. Combines case trend, LSTM forecast overlay, a composite
 * risk score, supporting early-warning alerts, and a draft/recommendation
 * action bar. Decision-support only — records are never auto-declared.
 */
export default function MunicipalDeclarationWorkspace({
  row = null,
  barangayId = null,
  weeklyTrend = [],
  diseaseFilter = "DENGUE",
  periodCaption = "",
  onClose
}) {
  const singleDisease = diseaseFilter !== "ALL";
  const { brief, loading: briefLoading } = useDecisionBrief({
    scopeType: "barangay",
    scopeId: barangayId,
    disease: diseaseFilter,
    enabled: singleDisease && Number.isFinite(Number(barangayId))
  });
  const { canMutate, createDeclaration } = useDeclarations({ enabled: false });

  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState({ status: "idle", message: "" });

  // Local instant score from the velocity row; replaced by the server brief's
  // authoritative score (which also folds in forecast + environmental) once loaded.
  const localRisk = useMemo(() => {
    if (!row || !singleDisease) return null;
    return computeRiskScore({
      disease: diseaseFilter,
      current: row.current,
      prior: row.prior,
      delta: row.delta,
      pctChange: row.pctChange
    });
  }, [row, diseaseFilter, singleDisease]);

  const risk = brief?.risk ?? localRisk;
  const threshold = thresholdForDisease(diseaseFilter);

  const chartData = useMemo(() => {
    const hist = (weeklyTrend ?? []).map((d) => ({ label: d.label, cases: d.cases, forecast: null }));
    const steps = brief?.forecast?.steps ?? [];
    if (hist.length && steps.length) {
      hist[hist.length - 1] = { ...hist[hist.length - 1], forecast: hist[hist.length - 1].cases };
    }
    const fc = steps.map((s) => ({
      label: `+${s.step}w`,
      cases: null,
      forecast: Number(s.predicted_cases) || 0
    }));
    return [...hist, ...fc];
  }, [weeklyTrend, brief]);

  if (!row) return null;

  async function handleCreate(status) {
    if (!canMutate || !singleDisease || !Number.isFinite(Number(barangayId))) return;
    setSaveState({ status: "saving", message: "" });
    try {
      await createDeclaration({
        scopeType: "barangay",
        scopeId: Number(barangayId),
        disease: diseaseFilter,
        status,
        notes: notes.trim() || undefined
      });
      setSaveState({
        status: "done",
        message: status === "recommended" ? "Recommendation recorded." : "Draft saved."
      });
      setNotes("");
    } catch (e) {
      setSaveState({ status: "error", message: e?.message ?? "Could not save declaration." });
    }
  }

  function handleCopyBrief() {
    if (!risk) return;
    const lines = [
      `ALERTO decision brief — ${row.barangay} · ${diseaseFilter}`,
      periodCaption,
      `Risk score: ${risk.score}/100 (${severityMeta(risk.severity).label})`,
      `Cases: current ${risk.current ?? row.current}, prior ${risk.prior ?? row.prior}, Δ ${row.delta}`,
      brief?.forecast
        ? `4-week forecast: ${brief.forecast.sum} cases (peak ${brief.forecast.peak}), threshold ${threshold}`
        : "4-week forecast: unavailable",
      `Supporting alerts: ${brief?.supportingAlerts?.length ?? 0}`,
      ...risk.factors.map((f) => `  - ${f.label}: ${f.points} pts (${f.detail})`)
    ];
    navigator.clipboard?.writeText(lines.join("\n")).then(
      () => setSaveState({ status: "done", message: "Brief copied to clipboard." }),
      () => setSaveState({ status: "error", message: "Clipboard unavailable." })
    );
  }

  const meta = risk ? severityMeta(risk.severity) : SEVERITY_META.normal;

  return (
    <section className="muni-panel muni-declare" aria-labelledby="muni-declare-title">
      <header className="muni-declare-head">
        <div>
          <p className="muni-section-kicker">Decision-support · meeting snapshot</p>
          <h3 id="muni-declare-title">Declaration workspace · {row.barangay}</h3>
          <p className="muni-section-sub">
            {periodCaption} · filter: {diseaseFilter}
          </p>
        </div>
        <button type="button" className="muni-declare-close" onClick={onClose} aria-label="Close workspace">
          ×
        </button>
      </header>

      {!singleDisease ? (
        <p className="muni-declare-placeholder">
          Pick a single disease (Dengue, ILI, or AWD) to see the risk score, forecast overlay, and
          declaration actions for {row.barangay}.
        </p>
      ) : (
        <div className="muni-declare-grid">
          <article className="muni-declare-card">
            <h4>Composite risk score</h4>
            {risk ? <RiskGauge risk={risk} /> : <p className="muni-declare-note">Computing…</p>}
            {briefLoading ? <p className="muni-declare-note muni-declare-note--muted">Refreshing with forecast…</p> : null}
          </article>

          <article className="muni-declare-card muni-declare-card--wide">
            <h4>Case trend &amp; 4-week forecast</h4>
            <p className="muni-declare-stat">
              Current window: <strong>{row.current}</strong> · Prior: <strong>{row.prior}</strong> · Δ{" "}
              <strong style={{ color: meta.color }}>{row.delta > 0 ? `+${row.delta}` : row.delta}</strong>
            </p>
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#64748b" }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748b" }} width={24} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="muni-chart-tooltip muni-chart-tooltip--compact" role="status">
                        <div className="muni-chart-tooltip-label">{label}</div>
                        {payload.map((p) => (
                          <div key={p.dataKey}>
                            {p.dataKey === "forecast" ? "Forecast" : "Cases"}: {Number(p.value ?? 0)}
                          </div>
                        ))}
                      </div>
                    ) : null
                  }
                />
                <ReferenceLine
                  y={threshold}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  label={{ value: `Threshold ${threshold}`, fontSize: 9, fill: "#dc2626", position: "insideTopRight" }}
                />
                <Line type="monotone" dataKey="cases" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
                <Bar dataKey="forecast" fill="rgba(245,158,11,0.7)" barSize={18} />
              </ComposedChart>
            </ResponsiveContainer>
            {brief?.forecast ? (
              <p className="muni-declare-note">
                LSTM projects <strong>{brief.forecast.sum}</strong> cases over the next 4 weeks (peak{" "}
                {brief.forecast.peak}){brief.forecast.exceedance ? " — above escalation threshold." : "."}{" "}
                {brief.forecast.asOfWeek ? `As of week of ${brief.forecast.asOfWeek}.` : ""}
              </p>
            ) : (
              <p className="muni-declare-note muni-declare-note--muted">
                Forecast unavailable (ML service offline or insufficient history).
              </p>
            )}
          </article>

          <article className="muni-declare-card">
            <h4>Supporting alerts</h4>
            {brief?.supportingAlerts?.length ? (
              <ul className="muni-declare-alert-list">
                {brief.supportingAlerts.map((a) => (
                  <li key={a.id}>
                    <span className={`muni-row-alert-tag muni-row-alert-tag--${a.severity}`}>
                      {severityMeta(a.severity).label}
                    </span>
                    <span>{a.barangay} · {a.triggerType}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muni-declare-note muni-declare-note--muted">
                No active early-warning alerts for this barangay and disease.
              </p>
            )}
            {brief?.environmental ? (
              <p className="muni-declare-note">
                Environmental risk flags positive in {Math.round(
                  (brief.environmental.positiveFlags / brief.environmental.totalFlags) * 100
                )}
                % of recent cases.
              </p>
            ) : null}
          </article>

          <article className="muni-declare-card muni-declare-card--wide muni-declare-actions">
            <h4>Declaration actions</h4>
            {canMutate ? (
              <>
                <textarea
                  className="muni-declare-notes"
                  placeholder="Optional notes for the record (rationale, coordination context)…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={4000}
                />
                <div className="muni-declare-action-row">
                  <button
                    type="button"
                    className="muni-declare-btn muni-declare-btn--ghost"
                    onClick={handleCopyBrief}
                  >
                    Copy brief
                  </button>
                  <button
                    type="button"
                    className="muni-declare-btn"
                    onClick={() => handleCreate("draft")}
                    disabled={saveState.status === "saving"}
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    className="muni-declare-btn muni-declare-btn--primary"
                    onClick={() => handleCreate("recommended")}
                    disabled={saveState.status === "saving"}
                  >
                    Recommend declaration
                  </button>
                </div>
                {saveState.message ? (
                  <p
                    className={`muni-declare-note ${
                      saveState.status === "error" ? "muni-declare-note--error" : ""
                    }`}
                  >
                    {saveState.message}
                  </p>
                ) : null}
                <p className="muni-declare-note muni-declare-note--muted">
                  Decision-support only — saving a draft or recommendation does not auto-declare an
                  outbreak. Formal declaration is a separate, deliberate action.
                </p>
              </>
            ) : (
              <p className="muni-declare-note muni-declare-note--muted">
                Declaration drafts are created by Municipal or Provincial Health Office accounts.
              </p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
