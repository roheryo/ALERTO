function deltaClass(delta) {
  if (delta > 0) return "prov-kpi-delta--up";
  if (delta < 0) return "prov-kpi-delta--down";
  return "prov-kpi-delta--flat";
}

function formatDeltaLabel(delta) {
  if (delta > 0) return `+${delta} WoW`;
  if (delta < 0) return `${delta} WoW`;
  return "No WoW change";
}

export default function ProvincialKpiCards({ kpis }) {
  return (
    <section className="card-container prov-kpis" aria-label="Province disease summary">
      <article className="summary-card blue prov-kpi-card">
        <h4>Acute Watery Diarrhea</h4>
        <h2>{kpis.awd.windowCount.toLocaleString()}</h2>
        <p className="prov-kpi-window">{kpis.awd.windowLabel}</p>
        <p className={`prov-kpi-delta ${deltaClass(kpis.awd.wowDelta)}`}>{formatDeltaLabel(kpis.awd.wowDelta)}</p>
      </article>
      <article className="summary-card red prov-kpi-card">
        <h4>Influenza-Like-Illness</h4>
        <h2>{kpis.ili.windowCount.toLocaleString()}</h2>
        <p className="prov-kpi-window">{kpis.ili.windowLabel}</p>
        <p className={`prov-kpi-delta ${deltaClass(kpis.ili.wowDelta)}`}>{formatDeltaLabel(kpis.ili.wowDelta)}</p>
      </article>
      <article className="summary-card orange prov-kpi-card">
        <h4>Dengue</h4>
        <h2>{kpis.dengue.windowCount.toLocaleString()}</h2>
        <p className="prov-kpi-window">{kpis.dengue.windowLabel}</p>
        <p className={`prov-kpi-delta ${deltaClass(kpis.dengue.wowDelta)}`}>
          {formatDeltaLabel(kpis.dengue.wowDelta)}
        </p>
      </article>
    </section>
  );
}
