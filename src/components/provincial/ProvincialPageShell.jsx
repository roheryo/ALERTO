import "@/styles/dashboard-shell.css";
import "@/pages/dashboard/ProvincialDashboard.css";
import DashboardPageHeader from "@/layout/DashboardPageHeader";

function fmtSyncedAt(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function ProvincialPageShell({
  title,
  subline = "",
  lastSyncedAt = null,
  loading = false,
  children
}) {
  const synced = fmtSyncedAt(lastSyncedAt);
  const sub =
    subline ||
    [
      "Davao de Oro · Provincial Health Office",
      synced ? `Last synced ${synced}` : null,
      loading ? "Updating…" : null
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="dashboard-container prov-page">
      <DashboardPageHeader pageTitle={title} subline={sub} />
      <div className="content-area content-area--provincial">{children}</div>
    </div>
  );
}
