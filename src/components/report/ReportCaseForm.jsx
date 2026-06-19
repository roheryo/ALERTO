import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPageHeader from "@/layout/DashboardPageHeader";
import "@/styles/dashboard-shell.css";
import "./ReportCaseForm.css";
import FormDateInput from "./FormDateInput";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import { PATIENTS_CHANGED_EVENT } from "../../hooks/usePatients";
import { barangaysForMunicipality, BARANGAY_BY_MUNICIPALITY } from "../../data/davaoDeOroGeography";
import { FORM_STEP_LABELS } from "../../lib/mlCaseFormSchema";

const TOTAL_STEPS = FORM_STEP_LABELS.length;

/** Plain-language step names shown in the step bar and progress list. */
const UI_STEP_LABELS = ["Case details", "Location", "Surroundings", "Review"];

const ICD_MAP = { dengue: "A90–A91", ili: "J10–J11", awd: "A00–A09" };
const NAME_MAP = { dengue: "Dengue", ili: "ILI", awd: "AWD" };

const WASH_WATER_LABELS = {
  piped: "Piped water into the home",
  shared: "Shared water source (tap stand or communal)",
  unimproved: "Well, river, or other untreated source",
  none: "No reliable water source"
};

const WASH_SANITATION_LABELS = {
  flush: "Flush toilet with septic tank",
  pit: "Pit latrine",
  open: "No toilet — open defecation",
  none: "No sanitation facility"
};

function diseaseTypeForApi(code) {
  const c = String(code ?? "").toLowerCase();
  if (c === "dengue") return "Dengue";
  if (c === "ili") return "Influenza-like illness (ILI)";
  if (c === "awd") return "Acute Watery Diarrhea";
  return "";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Epidemiological week index for a YYYY-MM-DD onset date. */
function getWeekNumberForIsoDate(isoYmd) {
  if (!isoYmd || typeof isoYmd !== "string") return null;
  const d = new Date(`${isoYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(d.getFullYear(), 0, 1);
  const w = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return Math.min(53, Math.max(1, w));
}

function monthLabelFromIso(isoYmd) {
  if (!isoYmd) return "";
  const d = new Date(`${isoYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "long" });
}

function IconChevRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconChevLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function defaultFields(user) {
  const muni = String(user?.municipality ?? "Mabini").trim() || "Mabini";
  const brgyList = barangaysForMunicipality(muni);
  const fallbackList = barangaysForMunicipality("Mabini");
  const brgy = String(user?.barangay ?? "").trim();
  const barangay = brgy && brgyList.includes(brgy) ? brgy : brgyList[0] || fallbackList[0] || "";

  return {
    disease: "",
    caseClass: "",
    dOnset: "",
    dEntry: todayStr(),
    patientNum: "",
    reporterLabel: "",
    municipality: muni,
    barangay,
    stagnantWater: false,
    recentRain: false,
    crowding: false,
    washWater: "",
    washSanitation: "",
    floodHistory: false,
    droughtHistory: false
  };
}

function SummaryBlock({ title, children }) {
  return (
    <div className="review-block">
      <div className="review-block-title">{title}</div>
      <div className="summary-grid">{children}</div>
    </div>
  );
}

function SummaryItem({ label, value, empty }) {
  return (
    <div className="summary-item">
      <div className="summary-label">{label}</div>
      <div className={`summary-value${empty ? " summary-value--empty" : ""}`}>{value || "—"}</div>
    </div>
  );
}

/**
 * Multi-step case report aligned with LSTM training schema
 * (disease, onset, classification, geography, environment).
 */
export default function ReportCaseForm({ user, onSubmitted }) {
  const { token } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepsCompleted, setStepsCompleted] = useState(() => Array(TOTAL_STEPS + 1).fill(false));
  const [fields, setFields] = useState(() => defaultFields(user));
  const [fieldErr, setFieldErr] = useState({});
  const [diseaseErr, setDiseaseErr] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [caseRef, setCaseRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const barangayOptions = useMemo(
    () => barangaysForMunicipality(fields.municipality),
    [fields.municipality]
  );

  const onsetWeek = useMemo(() => getWeekNumberForIsoDate(fields.dOnset), [fields.dOnset]);
  const onsetMonthLabel = useMemo(() => monthLabelFromIso(fields.dOnset), [fields.dOnset]);
  const onsetYear = useMemo(() => {
    if (!fields.dOnset) return "";
    const d = new Date(`${fields.dOnset}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "" : String(d.getFullYear());
  }, [fields.dOnset]);

  useEffect(() => {
    setFields((f) => ({ ...f, dEntry: f.dEntry || todayStr() }));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const topbarSub = useMemo(() => {
    const br = fields.barangay || user?.barangay || "—";
    const mu = fields.municipality || user?.municipality || "—";
    const weekPart = onsetWeek != null ? `Week ${onsetWeek}` : "Week —";
    const yearPart = onsetYear || new Date().getFullYear();
    return `BHU · Brgy. ${br}, ${mu} · ${weekPart}, ${yearPart}`;
  }, [fields.barangay, fields.municipality, onsetWeek, onsetYear, user]);

  const progressPct = useMemo(() => {
    const done = stepsCompleted.slice(1).filter(Boolean).length;
    return Math.round((done / TOTAL_STEPS) * 100);
  }, [stepsCompleted]);

  const setF = useCallback((patch) => {
    setFields((f) => ({ ...f, ...patch }));
  }, []);

  const clearErr = useCallback((keys) => {
    setFieldErr((e) => {
      const next = { ...e };
      keys.forEach((k) => {
        delete next[k];
      });
      return next;
    });
  }, []);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
  }, []);

  const sumDisease = fields.disease ? NAME_MAP[fields.disease] : null;
  const sumClass = fields.caseClass || null;
  const sumMorb =
    onsetWeek != null && onsetMonthLabel ? `Week ${onsetWeek} · ${onsetMonthLabel}` : null;

  const validateStep = (step) => {
    const err = {};
    let ok = true;

    if (step === 1) {
      if (!fields.disease) {
        setDiseaseErr(true);
        ok = false;
      } else setDiseaseErr(false);
      if (!fields.dOnset) {
        err.dOnset = true;
        ok = false;
      }
      if (!fields.dEntry) {
        err.dEntry = true;
        ok = false;
      }
      if (!fields.caseClass) {
        err.caseClass = true;
        ok = false;
      }
    }

    if (step === 2) {
      if (!fields.municipality) {
        err.municipality = true;
        ok = false;
      }
      if (!fields.barangay) {
        err.barangay = true;
        ok = false;
      }
    }

    setFieldErr(err);
    if (!ok) showToast("Please complete all required fields before continuing.", "warning");
    return ok;
  };

  const goToStep = (n) => {
    setCurrentStep(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nextStep = (from) => {
    if (!validateStep(from)) return;
    setStepsCompleted((s) => {
      const next = [...s];
      next[from] = true;
      return next;
    });
    goToStep(from + 1);
  };

  const prevStep = (from) => {
    goToStep(from - 1);
  };

  const updateBarangayOptions = useCallback((muni) => {
    setFields((f) => {
      const list = barangaysForMunicipality(muni);
      const nextBrgy = list.includes(f.barangay) ? f.barangay : list[0] || "";
      return { ...f, municipality: muni, barangay: nextBrgy };
    });
  }, []);

  const submitCase = async () => {
    for (let s = 1; s <= 2; s += 1) {
      if (!validateStep(s)) {
        goToStep(s);
        return;
      }
    }

    if (!token) {
      showToast("You must be signed in to submit a case.", "warning");
      return;
    }

    const diseaseType = diseaseTypeForApi(fields.disease);
    if (!diseaseType) {
      showToast("Select a disease type before submitting.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: (fields.reporterLabel || "").trim() || "Unnamed patient",
        province: user?.provinceName || user?.province || "Davao de Oro",
        municipality: fields.municipality,
        barangay: fields.barangay,
        diseaseType,
        dateStarted: fields.dOnset,
        caseClassification: fields.caseClass || null,
        outcome: "A",
        patientNumber: (fields.patientNum || "").trim() || null,
        environment: {
          stagnantWater: !!fields.stagnantWater,
          recentRain: !!fields.recentRain,
          crowding: !!fields.crowding,
          washWater: fields.washWater || null,
          washSanitation: fields.washSanitation || null,
          floodHistory: !!fields.floodHistory,
          droughtHistory: !!fields.droughtHistory,
          exposureNotes: null
        }
      };

      const data = await apiFetch("/patients", { token, method: "POST", body: payload });

      if (!fields.patientNum.trim() && data?.patientNumber) {
        setFields((f) => ({ ...f, patientNum: String(data.patientNumber) }));
      }

      setStepsCompleted((s) => {
        const next = [...s];
        next[TOTAL_STEPS] = true;
        return next;
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PATIENTS_CHANGED_EVENT));
      }

      const ref =
        typeof data?.caseRef === "string"
          ? data.caseRef
          : `DDO-${onsetYear || new Date().getFullYear()}-${data?.id ?? ""}`;
      setCaseRef(ref);
      setSuccessOpen(true);
    } catch (err) {
      showToast(err?.message ?? "Could not save this case. Please check your internet connection and try again.", "warning");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setStepsCompleted(Array(TOTAL_STEPS + 1).fill(false));
    setFields(defaultFields(user));
    setFieldErr({});
    setDiseaseErr(false);
    setSuccessOpen(false);
  };

  const confirmReset = () => {
    if (typeof window !== "undefined" && window.confirm("Discard all entered data and start over?")) resetForm();
  };

  const envFlags = [
    fields.stagnantWater && "Stagnant water near home",
    fields.recentRain && "Heavy rain in the past 2 weeks",
    fields.crowding && "Crowded indoor spaces",
    fields.floodHistory && "Recent flooding in the barangay",
    fields.droughtHistory && "Drought or water shortage"
  ].filter(Boolean);

  return (
    <div className="report-case-form">
      {toast ? (
        <div className={`toast-rc ${toast.type}`} role="status">
          {toast.msg}
        </div>
      ) : null}

      <DashboardPageHeader pageTitle="Report New Case" subline={topbarSub} />

      <div className="rc-main">
        <div className="content">
          <div className="section-header">
            <div className="section-heading">
              <h2 className="section-title">Report Disease Case</h2>
              <p className="section-desc">
                Fill in the details below about the patient and their surroundings. This information helps
                track diseases in your community and supports early outbreak warnings.
              </p>
            </div>
            <Link to="/dashboard/cases" className="btn btn-outline btn-sm section-header-btn">
              <IconClock />
              Case Logs
            </Link>
          </div>

          <div className="step-bar" aria-hidden>
            {UI_STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              return (
                <div
                  key={label}
                  className={`step${currentStep > stepNum ? " done" : ""}${currentStep === stepNum ? " active" : ""}`}
                >
                  <div className="step-inner">
                    <div className="step-circle">{stepNum}</div>
                    <div className="step-label">{label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="form-layout">
            <div className="form-col">
              {/* Step 1 — Surveillance */}
              <div className={`step-page${currentStep === 1 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 1 — Case details</div>
                    <span className="badge badge-info">
                      <span className="badge-dot" />
                      Required
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="alert-banner info">
                      <div className="alert-icon">ℹ️</div>
                      <div>
                        <div className="alert-title">Diseases we monitor</div>
                        <div className="alert-body">
                          ALERTO tracks Dengue, flu-like illness (ILI), and acute watery diarrhea (AWD).
                          Choose the classification that best matches what you know when you submit this report.
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon form-section-icon--dengue">🦟</div>
                        <div>
                          <div className="form-section-title form-section-title--dengue">Which disease?</div>
                          <div className="form-section-desc">Select the illness for this patient</div>
                        </div>
                      </div>
                      <div className="radio-cards">
                        {[
                          { v: "dengue", cls: "dengue", icon: "🦟", t: "Dengue", s: "Spread by mosquitoes" },
                          { v: "ili", cls: "ili", icon: "🤧", t: "ILI", s: "Flu-like illness" },
                          { v: "awd", cls: "awd", icon: "💧", t: "AWD", s: "Acute watery diarrhea" }
                        ].map((d) => (
                          <label key={d.v} className={`radio-card ${d.cls}`}>
                            <input
                              type="radio"
                              name="disease"
                              value={d.v}
                              checked={fields.disease === d.v}
                              onChange={() => {
                                setF({ disease: d.v });
                                setDiseaseErr(false);
                              }}
                            />
                            <div className="radio-card-icon">{d.icon}</div>
                            <div className="radio-card-label">{d.t}</div>
                            <div className="radio-card-sub">{d.s}</div>
                          </label>
                        ))}
                      </div>
                      <div className={`disease-error-inline${diseaseErr ? " visible" : ""}`}>
                        Please select a disease type to continue.
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon form-section-icon--warning">📅</div>
                        <div>
                          <div className="form-section-title form-section-title--warning">Important dates</div>
                          <div className="form-section-desc">
                            The first day of symptoms decides which week this case is counted in
                          </div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="dOnset">
                            Date symptoms started <span className="req">*</span>
                            <span className="lbl-tag model">For tracking</span>
                          </label>
                          <FormDateInput
                            id="dOnset"
                            value={fields.dOnset}
                            error={!!fieldErr.dOnset}
                            onChange={(v) => {
                              setF({ dOnset: v });
                              clearErr(["dOnset"]);
                            }}
                          />
                          <div className="form-hint">When symptoms first started</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="dEntry">
                            Date reported <span className="req">*</span>
                          </label>
                          <FormDateInput
                            id="dEntry"
                            value={fields.dEntry}
                            error={!!fieldErr.dEntry}
                            onChange={(v) => {
                              setF({ dEntry: v });
                              clearErr(["dEntry"]);
                            }}
                          />
                          <div className="form-hint">Defaults to today; change if you are reporting late</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="epiWeekDisplay">
                            Reporting week <span className="lbl-tag">Automatic</span>
                          </label>
                          <input
                            id="epiWeekDisplay"
                            className="form-input form-input--readonly"
                            type="text"
                            readOnly
                            value={
                              onsetWeek != null && onsetMonthLabel
                                ? `Week ${onsetWeek} · ${onsetMonthLabel} ${onsetYear}`
                                : ""
                            }
                            placeholder="Enter date of onset above"
                          />
                          <div className="form-hint">Filled in automatically from the date of onset</div>
                        </div>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon form-section-icon--primary">📋</div>
                        <div>
                          <div className="form-section-title">Case classification</div>
                          <div className="form-section-desc">
                            Pick the best fit based on what you know now. Confirmed cases are counted first in
                            official reports.
                          </div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="caseClass">
                            Classification <span className="req">*</span>
                            <span className="lbl-tag model">For tracking</span>
                          </label>
                          <select
                            id="caseClass"
                            className={`form-select${fieldErr.caseClass ? " error" : ""}`}
                            value={fields.caseClass}
                            onChange={(e) => {
                              setF({ caseClass: e.target.value });
                              clearErr(["caseClass"]);
                            }}
                          >
                            <option value="">— Choose classification —</option>
                            <option value="Suspect">Suspect</option>
                            <option value="Probable">Probable</option>
                            <option value="Confirmed">Confirmed</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="form-nav">
                      <span />
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-primary" onClick={() => nextStep(1)}>
                          Next: Location
                          <IconChevRight />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 — Location */}
              <div className={`step-page${currentStep === 2 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 2 — Location & case number</div>
                    <span className="badge badge-info">
                      <span className="badge-dot" />
                      Required
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="alert-banner info">
                      <div className="alert-icon">📍</div>
                      <div>
                        <div className="alert-title">Where the patient lives</div>
                        <div className="alert-body">
                          Choose the correct municipality and barangay so this case shows up in the right place on
                          provincial and municipal reports.
                        </div>
                      </div>
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label" htmlFor="patientNum">
                          Case or patient number
                        </label>
                        <input
                          id="patientNum"
                          className="form-input"
                          type="text"
                          placeholder="Optional — a number will be assigned if you leave this blank"
                          value={fields.patientNum}
                          onChange={(e) => setF({ patientNum: e.target.value })}
                        />
                        <div className="form-hint">Reference number from your health center, if you have one</div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="reporterLabel">
                          Patient name (optional)
                        </label>
                        <input
                          id="reporterLabel"
                          className="form-input"
                          type="text"
                          placeholder="Leave blank if unknown"
                          value={fields.reporterLabel}
                          onChange={(e) => setF({ reporterLabel: e.target.value })}
                        />
                        <div className="form-hint">
                          If empty, the record will be saved as &quot;Unnamed patient&quot;
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="municipality">
                          Municipality <span className="req">*</span>
                          <span className="lbl-tag model">For tracking</span>
                        </label>
                        <select
                          id="municipality"
                          className={`form-select${fieldErr.municipality ? " error" : ""}`}
                          value={fields.municipality}
                          onChange={(e) => {
                            updateBarangayOptions(e.target.value);
                            clearErr(["municipality"]);
                          }}
                        >
                          {Object.keys(BARANGAY_BY_MUNICIPALITY).map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="barangay">
                          Barangay <span className="req">*</span>
                          <span className="lbl-tag model">For tracking</span>
                        </label>
                        <select
                          id="barangay"
                          className={`form-select${fieldErr.barangay ? " error" : ""}`}
                          value={fields.barangay}
                          onChange={(e) => {
                            setF({ barangay: e.target.value });
                            clearErr(["barangay"]);
                          }}
                        >
                          {barangayOptions.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-nav">
                      <button type="button" className="btn btn-outline" onClick={() => prevStep(2)}>
                        <IconChevLeft />
                        Back
                      </button>
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-primary" onClick={() => nextStep(2)}>
                          Next: Surroundings
                          <IconChevRight />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 — Environment */}
              <div className={`step-page${currentStep === 3 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 3 — Home & surroundings</div>
                    <span className="badge badge-success">
                      <span className="badge-dot" />
                      Helps spot outbreaks
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="alert-banner warning">
                      <div className="alert-icon">🌧</div>
                      <div>
                        <div className="alert-title">Conditions around the patient</div>
                        <div className="alert-body">
                          These questions describe the home and neighborhood. Your answers help link cases to
                          patterns such as rain, floods, and water access.
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon form-section-icon--dengue">🦟</div>
                        <div>
                          <div className="form-section-title form-section-title--dengue">Mosquitoes & spread of illness</div>
                        </div>
                      </div>
                      <div className="check-list">
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.stagnantWater}
                            onChange={(e) => setF({ stagnantWater: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">
                              Stagnant water near home <span className="lbl-tag model">For tracking</span>
                            </div>
                            <div className="check-row-sub">
                              Uncovered containers, clogged canals, and other mosquito breeding sites
                            </div>
                          </div>
                        </label>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.recentRain}
                            onChange={(e) => setF({ recentRain: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">
                              Heavy rainfall (past 2 weeks) <span className="lbl-tag model">For tracking</span>
                            </div>
                            <div className="check-row-sub">Heavy or steady rain in the last two weeks</div>
                          </div>
                        </label>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.crowding}
                            onChange={(e) => setF({ crowding: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">
                              Indoor crowding / poor ventilation <span className="lbl-tag model">For tracking</span>
                            </div>
                            <div className="check-row-sub">Many people sharing a small indoor space, or poor airflow</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon form-section-icon--awd">🚿</div>
                        <div>
                          <div className="form-section-title form-section-title--awd">Water & sanitation</div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="washWater">
                            Water source <span className="lbl-tag model">For tracking</span>
                          </label>
                          <select
                            id="washWater"
                            className="form-select"
                            value={fields.washWater}
                            onChange={(e) => setF({ washWater: e.target.value })}
                          >
                            <option value="">— Choose one —</option>
                            <option value="piped">Piped water into the home</option>
                            <option value="shared">Shared water source (tap stand or communal)</option>
                            <option value="unimproved">Well, river, or other untreated source</option>
                            <option value="none">No reliable water source</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="washSanitation">
                            Toilet facility <span className="lbl-tag model">For tracking</span>
                          </label>
                          <select
                            id="washSanitation"
                            className="form-select"
                            value={fields.washSanitation}
                            onChange={(e) => setF({ washSanitation: e.target.value })}
                          >
                            <option value="">— Choose one —</option>
                            <option value="flush">Flush toilet with septic tank</option>
                            <option value="pit">Pit latrine</option>
                            <option value="open">No toilet — open defecation</option>
                            <option value="none">No sanitation facility</option>
                          </select>
                        </div>
                      </div>
                      <div className="check-list">
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.floodHistory}
                            onChange={(e) => setF({ floodHistory: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">
                              Recent flooding in barangay <span className="lbl-tag model">For tracking</span>
                            </div>
                            <div className="check-row-sub">Flooding in the barangay within the past month</div>
                          </div>
                        </label>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.droughtHistory}
                            onChange={(e) => setF({ droughtHistory: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">
                              Drought / water shortage <span className="lbl-tag model">For tracking</span>
                            </div>
                            <div className="check-row-sub">Ongoing dry spell or limited safe drinking water</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="form-nav">
                      <button type="button" className="btn btn-outline" onClick={() => prevStep(3)}>
                        <IconChevLeft />
                        Back
                      </button>
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-primary" onClick={() => nextStep(3)}>
                          Review & submit
                          <IconChevRight />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 — Review */}
              <div className={`step-page${currentStep === 4 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 4 — Review & submit</div>
                    <span className="badge badge-success">
                      <span className="badge-dot" />
                      Final check
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="alert-banner success">
                      <div className="alert-icon">✅</div>
                      <div>
                        <div className="alert-title">Ready to submit</div>
                        <div className="alert-body">
                          Please review everything below. When you submit, this case is added to provincial disease
                          monitoring and helps warn your community early if cases rise.
                        </div>
                      </div>
                    </div>

                    <SummaryBlock title="Case details">
                      <SummaryItem
                        label="Disease"
                        value={fields.disease ? NAME_MAP[fields.disease] : null}
                        empty={!fields.disease}
                      />
                      <SummaryItem label="Date symptoms started" value={fields.dOnset} empty={!fields.dOnset} />
                      <SummaryItem label="Date reported" value={fields.dEntry} empty={!fields.dEntry} />
                      <SummaryItem label="Classification" value={fields.caseClass} empty={!fields.caseClass} />
                      <SummaryItem
                        label="Reporting week"
                        value={sumMorb}
                        empty={!sumMorb}
                      />
                    </SummaryBlock>

                    <SummaryBlock title="Location">
                      <SummaryItem label="Case number" value={fields.patientNum || "Will be assigned automatically"} />
                      <SummaryItem label="Municipality" value={fields.municipality} />
                      <SummaryItem label="Barangay" value={fields.barangay} />
                    </SummaryBlock>

                    <SummaryBlock title="Home & surroundings">
                      <SummaryItem
                        label="Conditions checked"
                        value={envFlags.length ? envFlags.join(", ") : "None selected"}
                      />
                      <SummaryItem
                        label="Water source"
                        value={WASH_WATER_LABELS[fields.washWater] || null}
                        empty={!fields.washWater}
                      />
                      <SummaryItem
                        label="Toilet facility"
                        value={WASH_SANITATION_LABELS[fields.washSanitation] || null}
                        empty={!fields.washSanitation}
                      />
                    </SummaryBlock>

                    <div className="certification-box">
                      <strong>I confirm:</strong> By submitting, I certify that the information entered is
                      accurate to the best of my knowledge and is based on an actual visit or consultation at BHU
                      Brgy. {fields.barangay || "—"}, {fields.municipality || "—"}.
                    </div>

                    <div className="form-nav">
                      <button type="button" className="btn btn-outline" onClick={() => prevStep(4)}>
                        <IconChevLeft />
                        Back
                      </button>
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-outline btn-danger" onClick={confirmReset}>
                          Discard
                        </button>
                        <button type="button" className="btn btn-primary" disabled={submitting} onClick={submitCase}>
                          {submitting ? (
                            "Submitting…"
                          ) : (
                            <>
                              <IconCheck />
                              Submit case report
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="context-col" aria-label="Summary while you fill out the form">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Case summary</div>
                  <span className="tag">Updates as you type</span>
                </div>
                <div className="panel-body panel-body--compact">
                  <SummaryItem label="Disease" value={sumDisease} empty={!sumDisease} />
                  <SummaryItem label="Symptoms started" value={fields.dOnset} empty={!fields.dOnset} />
                  <SummaryItem label="Reporting week" value={sumMorb} empty={!sumMorb} />
                  <SummaryItem label="Classification" value={sumClass} empty={!sumClass} />
                  <SummaryItem label="Municipality" value={fields.municipality} />
                  <SummaryItem label="Barangay" value={fields.barangay} />
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Your progress</div>
                </div>
                <div className="panel-body panel-body--compact">
                  <div className="progress-header">
                    <span>Steps completed</span>
                    <span className="progress-pct">{progressPct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <ul className="progress-checklist">
                    {UI_STEP_LABELS.map((label, i) => (
                      <li key={label} className={stepsCompleted[i + 1] ? "done" : ""}>
                        <span aria-hidden>{stepsCompleted[i + 1] ? "✓" : "○"}</span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="alert-banner info alert-banner--sidebar">
                <div className="alert-banner-sidehead">
                  <span className="alert-icon" aria-hidden>
                    🤖
                  </span>
                  <div className="alert-title">Which fields matter most?</div>
                </div>
                <div className="alert-body">
                  <p>
                    Items marked <span className="lbl-tag model">For tracking</span> are used to count cases by
                    week, place, and disease — the same information that powers outbreak alerts in ALERTO.
                  </p>
                  <p className="alert-body-note">
                    Rain and temperature for your area are added automatically from official weather records.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay${successOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-title"
      >
        <div className="modal">
          <div className="modal-success-body">
            <div className="success-check">✓</div>
            <div id="success-title" className="modal-success-title">
              Case submitted
            </div>
            <p className="modal-success-desc">
              Your case report has been saved. It will be included in provincial disease monitoring and helps
              the system warn your community if cases start to rise.
            </p>
            <div className="modal-ref-box">
              <div className="modal-ref-label">Reference number</div>
              <div className="modal-ref-value">{caseRef}</div>
              <div className="modal-ref-sub">
                Brgy. {fields.barangay} · {fields.municipality}
                {onsetWeek != null ? ` · Week ${onsetWeek}` : ""}
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSuccessOpen(false);
                  resetForm();
                }}
              >
                Report another
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setSuccessOpen(false);
                  if (typeof onSubmitted === "function") onSubmitted();
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
