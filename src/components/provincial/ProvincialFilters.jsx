const DISEASE_OPTIONS = [
  { value: "DENGUE", label: "Dengue" },
  { value: "ILI", label: "ILI" },
  { value: "AWD", label: "AWD" },
  { value: "ALL", label: "All diseases" }
];

const DISEASE_BUTTON_OPTIONS = [
  { value: "DENGUE", label: "Dengue", buttonClass: "prov-disease-btn--dengue" },
  { value: "ILI", label: "ILI", buttonClass: "prov-disease-btn--ili" },
  { value: "AWD", label: "AWD", buttonClass: "prov-disease-btn--awd" },
  { value: "ALL", label: "All", buttonClass: "prov-disease-btn--all" }
];

function DiseaseButtonGroup({ diseaseFilter, onChange }) {
  return (
    <div
      className="prov-dash-disease-buttons"
      role="group"
      aria-label="Choose a disease to view"
    >
      {DISEASE_BUTTON_OPTIONS.map((o) => {
        const isActive = diseaseFilter === o.value;
        return (
          <button
            key={o.value}
            type="button"
            className={[
              "prov-disease-btn",
              o.buttonClass,
              isActive ? "prov-disease-btn--active" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={isActive}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ProvincialFilters({
  filters,
  patchFilters,
  periodCaption,
  municipalities = [],
  showGeoToggle = false,
  showMunicipalityFilter = true,
  showMapMetric = false,
  compact = false,
  diseaseControl = "select",
  inline = false
}) {
  const toolbarCols = [
    true,
    showMunicipalityFilter,
    showGeoToggle,
    showMapMetric
  ].filter(Boolean).length;

  if (inline && diseaseControl === "buttons") {
    return (
      <DiseaseButtonGroup
        diseaseFilter={filters.diseaseFilter}
        onChange={(value) => patchFilters({ diseaseFilter: value })}
      />
    );
  }

  return (
    <section
      className={`prov-panel prov-filters${compact ? " prov-filters--compact" : ""}`}
      aria-label="Surveillance filters"
      data-toolbar-cols={toolbarCols}
    >
      {compact ? null : (
        <header className="prov-filters-head">
          <h3>Filters</h3>
          {periodCaption ? <p className="prov-sub prov-filters-period">{periodCaption}</p> : null}
        </header>
      )}

      <div className="prov-filters-toolbar">
        {diseaseControl === "buttons" ? (
          <DiseaseButtonGroup
            diseaseFilter={filters.diseaseFilter}
            onChange={(value) => patchFilters({ diseaseFilter: value })}
          />
        ) : (
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
        )}

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
