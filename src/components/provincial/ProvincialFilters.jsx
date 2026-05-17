import { formatWindowLabel } from "@/lib/surveillance";

const DISEASE_OPTIONS = [
  { value: "DENGUE", label: "Dengue" },
  { value: "ILI", label: "ILI" },
  { value: "AWD", label: "AWD" },
  { value: "ALL", label: "All diseases" }
];

const WINDOW_WEEK_OPTIONS = [2, 3, 4];
const MAX_PERIOD_OFFSET = 6;

export default function ProvincialFilters({
  filters,
  patchFilters,
  periodCaption,
  windows,
  municipalities = [],
  showGeoToggle = false,
  showMunicipalityFilter = true,
  showMapMetric = false
}) {
  const periodOffsetLabel =
    filters.periodOffset === 0
      ? "Current period"
      : `${filters.periodOffset} period${filters.periodOffset > 1 ? "s" : ""} earlier`;

  function handleWindowModeChange(mode) {
    patchFilters({ windowMode: mode, periodOffset: 0 });
  }

  return (
    <section className="prov-panel prov-filters" aria-label="Surveillance filters">
      <header className="prov-section-head">
        <div>
          <p className="prov-kicker">Time &amp; disease</p>
          <h3>Surveillance window</h3>
          <p className="prov-sub">{periodCaption}</p>
          <p className="prov-note">Rolling sums · raw case counts (per 100k when population data is available)</p>
        </div>
      </header>

      <div className="prov-filters-row">
        <label className="prov-control">
          <span>Window</span>
          <select
            value={filters.windowMode === "month" ? "month" : String(filters.windowWeeks)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "month") handleWindowModeChange("month");
              else patchFilters({ windowMode: "weeks", windowWeeks: Number(v), periodOffset: 0 });
            }}
          >
            {WINDOW_WEEK_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w} weeks
              </option>
            ))}
            <option value="month">This month</option>
          </select>
        </label>

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
            <span>Municipality focus</span>
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
            <legend>Geography view</legend>
            <label>
              <input
                type="radio"
                name="prov-geo"
                checked={filters.geoView === "municipality"}
                onChange={() => patchFilters({ geoView: "municipality" })}
              />
              By municipality
            </label>
            <label>
              <input
                type="radio"
                name="prov-geo"
                checked={filters.geoView === "barangay"}
                onChange={() => patchFilters({ geoView: "barangay" })}
              />
              By barangay
            </label>
          </fieldset>
        ) : null}

        {showMapMetric ? (
          <label className="prov-control">
            <span>Map metric</span>
            <select
              value={filters.mapMetric}
              onChange={(e) => patchFilters({ mapMetric: e.target.value })}
            >
              <option value="velocity">Velocity (Δ)</option>
              <option value="count">Current window count</option>
            </select>
          </label>
        ) : null}

        <label className="prov-control prov-control--slider">
          <span>
            Time shift · <strong>{periodOffsetLabel}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={MAX_PERIOD_OFFSET}
            step={1}
            value={filters.periodOffset}
            onChange={(e) => patchFilters({ periodOffset: Number(e.target.value) })}
          />
          <span className="prov-slider-hint">Ending {formatWindowLabel(windows?.current)}</span>
        </label>
      </div>
    </section>
  );
}
