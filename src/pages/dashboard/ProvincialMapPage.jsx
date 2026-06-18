import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ProvincialFilters from "@/components/provincial/ProvincialFilters";
import ProvincialPageShell from "@/components/provincial/ProvincialPageShell";
import ProvinceMunicipalityMap from "@/components/provincial/ProvinceMunicipalityMap";
import ProvincialVelocityTable from "@/components/provincial/ProvincialVelocityTable";
import { useProvincialSurveillance } from "@/hooks/useProvincialSurveillance";
import "./ProvincialDashboard.css";

export default function ProvincialMapPage() {
  const {
    loading,
    error,
    lastSyncedAt,
    filters,
    patchFilters,
    periodCaption,
    municipalityRows,
    barangayRows
  } = useProvincialSurveillance();

  const [selectedMuniKey, setSelectedMuniKey] = useState(null);

  useEffect(() => {
    patchFilters({ municipalityFilter: "" });
  }, [patchFilters]);

  const selectedMunicipality = useMemo(() => {
    if (!selectedMuniKey) return "";
    const row = municipalityRows.find((r) => r.municipalityKey === selectedMuniKey);
    return row?.municipality ?? "";
  }, [selectedMuniKey, municipalityRows]);

  const drillBarangays = useMemo(() => {
    if (!selectedMunicipality) return [];
    return barangayRows.filter((r) => r.municipality === selectedMunicipality);
  }, [barangayRows, selectedMunicipality]);

  function handleMapSelect(key) {
    setSelectedMuniKey((prev) => (prev === key ? null : key));
  }

  return (
    <ProvincialPageShell
      title="Province surveillance map"
      subline="Choropleth-style municipality view · click to drill down"
      lastSyncedAt={lastSyncedAt}
      loading={loading}
    >
      {loading ? <p className="prov-status">Loading…</p> : null}
      {error ? <p className="prov-status prov-status--error">{error}</p> : null}

      {!loading && !error ? (
        <div className="prov-dash">
          <ProvincialFilters
            filters={filters}
            patchFilters={patchFilters}
            periodCaption={periodCaption}
            showMapMetric
            showMunicipalityFilter={false}
          />

          <section className="prov-panel prov-map-section">
            <ProvinceMunicipalityMap
              municipalityRows={municipalityRows}
              mapMetric={filters.mapMetric}
              selectedMunicipalityKey={selectedMuniKey}
              onSelectMunicipality={handleMapSelect}
            />
            <p className="prov-note">
              Click a municipality to filter barangay drill-down below, or open{" "}
              <Link to="/dashboard/province-rankings" className="prov-inline-link">
                Rankings
              </Link>{" "}
              for full tables.
            </p>
          </section>

          {selectedMunicipality ? (
            <section className="prov-panel" aria-labelledby="prov-drill-title">
              <h3 id="prov-drill-title">Barangay drill-down · {selectedMunicipality}</h3>
              <ProvincialVelocityTable rows={drillBarangays} mode="barangay" />
            </section>
          ) : (
            <p className="prov-empty prov-panel">Select a municipality on the map to view barangay counts.</p>
          )}
        </div>
      ) : null}
    </ProvincialPageShell>
  );
}
