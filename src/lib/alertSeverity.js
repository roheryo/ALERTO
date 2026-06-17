/** Early-Warning severity → display label + existing notify CSS class. */
export const SEVERITY_META = {
  high: { label: "High risk", className: "high" },
  elevated: { label: "Elevated", className: "warning" },
  watch: { label: "Watch", className: "info" }
};

export function severityMeta(severity) {
  return SEVERITY_META[severity] ?? { label: String(severity ?? "—"), className: "info" };
}

export function severityClass(severity) {
  return severityMeta(severity).className;
}
