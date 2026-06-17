import AlertCard from "./AlertCard";

const SECTION_ORDER = [
  { key: "high", title: "High risk" },
  { key: "elevated", title: "Elevated" },
  { key: "watch", title: "Watch" }
];

/**
 * Renders Early-Warning alerts grouped by severity (high → elevated → watch).
 * @param {{ grouped: object, canMutate: boolean, onAcknowledge: Function, onDismiss: Function }} props
 */
function AlertFeed({ grouped, canMutate, onAcknowledge, onDismiss }) {
  const sections = SECTION_ORDER.filter((s) => (grouped?.[s.key]?.length ?? 0) > 0);

  if (sections.length === 0) {
    return (
      <div className="notify-empty" role="status" aria-live="polite">
        <h3 style={{ marginBottom: "0.5rem" }}>No active alerts</h3>
        <p style={{ maxWidth: 540, margin: "0 auto", color: "#475569" }}>
          No barangay in your area is currently showing an outbreak-risk pattern. New alerts appear
          here automatically as cases are reported.
        </p>
      </div>
    );
  }

  return (
    <div className="notify-feed">
      {sections.map((section) => (
        <section key={section.key} className="notify-section">
          <h3 className="notify-section-title">
            {section.title}
            <span className="notify-section-count">{grouped[section.key].length}</span>
          </h3>
          <div className="notify-grid">
            {grouped[section.key].map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                canMutate={canMutate}
                onAcknowledge={onAcknowledge}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default AlertFeed;
