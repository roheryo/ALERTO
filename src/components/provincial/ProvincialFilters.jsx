const DISEASE_OPTIONS = [
  { value: "DENGUE", label: "Dengue" },
  { value: "ILI", label: "ILI" },
  { value: "AWD", label: "AWD" },
  { value: "ALL", label: "All diseases" }
];

export default function ProvincialFilters({
  filters,
  patchFilters,
  periodCaption,
  municipalities = [],
  showGeoToggle = false,
  showMunicipalityFilter = true,
  showMapMetric = false
}) {
  const toolbarCols = [
    true,
    showMunicipalityFilter,
    showGeoToggle,
    showMapMetric
  ].filter(Boolean).length;

  return (
    <section
      className="prov-panel prov-filters"
      aria-label="Surveillance filters"
      data-toolbar-cols={toolbarCols}
    >
      <header className="prov-filters-head">
        <h3>Filters</h3>
        {periodCaption ? <p className="prov-sub prov-filters-period">{periodCaption}</p> : null}
      </header>

      <div className="prov-filters-toolbar">
        <label className="prov-control">
          <span>Disease</span>
          <select
            value={filters.diseaseFilter}
            onChange={(e) => patchFilters({ diseaseFilter: e.target.value })}
          >
            {DISEASE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {showMunicipalityFilter ? (
          <label className="prov-control">
            <span>Municipality</span>
            <select
              value={filters.municipalityFilter}
              onChange={(e) => patchFilters({ municipalityFilter: e.target.value })}
            >
              <option value="">All municipalities</option>
              {municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showGeoToggle ? (
          <fieldset className="prov-geo-toggle">
            <legend>View by</legend>
            <div className="prov-geo-options" role="group" aria-label="View by">
              <label className="prov-geo-option">
                <input
                  type="radio"
                  name="prov-geo"
                  checked={filters.geoView === "municipality"}
                  onChange={() => patchFilters({ geoView: "municipality" })}
                />
                Municipality
              </label>
              <label className="prov-geo-option">
                <input
                  type="radio"
                  name="prov-geo"
                  checked={filters.geoView === "barangay"}
                  onChange={() => patchFilters({ geoView: "barangay" })}
                />
                Barangay
              </label>
            </div>
          </fieldset>
        ) : null}

        {showMapMetric ? (
          <label className="prov-control">
            <span>Map shows</span>
            <select
              value={filters.mapMetric}
              onChange={(e) => patchFilters({ mapMetric: e.target.value })}
            >
              <option value="velocity">Change (Δ)</option>
              <option value="count">Case count</option>
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}
