import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardPageHeader from "@/layout/DashboardPageHeader";
import "@/styles/dashboard-shell.css";
import "./ReportCaseForm.css";
import FormDateInput from "./FormDateInput";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import { PATIENTS_CHANGED_EVENT } from "../../hooks/usePatients";
import { BARANGAY_BY_MUNICIPALITY, barangaysForMunicipality } from "../../data/davaoDeOroGeography";

function diseaseTypeForApi(code) {
  const c = String(code ?? "").toLowerCase();
  if (c === "dengue") return "Dengue";
  if (c === "ili") return "Influenza-like illness (ILI)";
  if (c === "awd") return "Acute Watery Diarrhea";
  return "";
}

const TOTAL_STEPS = 5;

const ICD_MAP = { dengue: "A90–A91", ili: "J10–J11", awd: "A00–A09" };
const NAME_MAP = { dengue: "🦟 Dengue", ili: "🤧 ILI", awd: "💧 AWD" };

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

/** Same week index as getCurrentWeek, for a YYYY-MM-DD onset date (aligns morbidity fields with onset). */
function getWeekNumberForIsoDate(isoYmd) {
  if (!isoYmd || typeof isoYmd !== "string") return null;
  const d = new Date(`${isoYmd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(d.getFullYear(), 0, 1);
  const w = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return Math.min(53, Math.max(1, w));
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
    morbWeek: String(getCurrentWeek()),
    morbMonth: String(new Date().getMonth() + 1),
    reportingYear: String(new Date().getFullYear()),
    patientNum: "",
    fullName: "",
    ageYears: "",
    ageMonths: "",
    ageDays: "",
    sex: "",
    dob: "",
    municipality: muni,
    barangay,
    streetPurok: "",
    dOnset: "",
    dAdmit: "",
    dEntry: todayStr(),
    admitted: "",
    facilityType: "RHU",
    outcome: "",
    dateDied: "",
    labResult: "Not Done",
    organism: "",
    sariFlag: false,
    sentinelSite: false,
    stagnantWater: false,
    recentRain: false,
    crowding: false,
    washWater: "",
    washSanitation: "",
    floodHistory: false,
    droughtHistory: false,
    notes: ""
  };
}

/**
 * Multi-step report case UI — parity with standalone reference HTML (light theme).
 * @param {{ name?: string, email?: string, municipality?: string, barangay?: string, province?: string }} [user]
 * @param {() => void} [onSubmitted]
 */
export default function ReportCaseForm({ user, onSubmitted }) {
  const { token } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepsCompleted, setStepsCompleted] = useState(() => Array(TOTAL_STEPS + 1).fill(false));
  const [fields, setFields] = useState(() => defaultFields(user));
  const [fieldErr, setFieldErr] = useState({});
  const [diseaseErr, setDiseaseErr] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [caseRef, setCaseRef] = useState("DDO-2025-1285");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const barangayOptions = useMemo(
    () => barangaysForMunicipality(fields.municipality),
    [fields.municipality]
  );

  useEffect(() => {
    setFields((f) => ({ ...f, dEntry: f.dEntry || todayStr(), morbWeek: f.morbWeek || String(getCurrentWeek()) }));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const lagText = useMemo(() => {
    const onset = new Date(`${fields.dOnset}T12:00:00`);
    const admit = new Date(`${fields.dAdmit}T12:00:00`);
    if (!fields.dOnset || !fields.dAdmit || Number.isNaN(onset) || Number.isNaN(admit)) return "";
    const lag = Math.round((admit - onset) / 86400000);
    return `${lag} day${lag !== 1 ? "s" : ""}`;
  }, [fields.dOnset, fields.dAdmit]);

  const monthLabel = useMemo(() => {
    const m = MONTH_OPTIONS.find((o) => o.value === fields.morbMonth);
    return m?.label ?? "";
  }, [fields.morbMonth]);

  const topbarSub = useMemo(() => {
    const br = fields.barangay || user?.barangay || "—";
    const mu = fields.municipality || user?.municipality || "—";
    return `BHU · Brgy. ${br}, ${mu} · Week ${fields.morbWeek || "—"}, ${fields.reportingYear || "—"}`;
  }, [fields.barangay, fields.municipality, fields.morbWeek, fields.reportingYear, user]);

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
    fields.morbWeek && monthLabel ? `Week ${fields.morbWeek} · ${monthLabel}` : null;
  const sumMuni = fields.municipality || "Mabini";
  const sumBrgy = fields.barangay || "Cabuyuan";
  const sumSex = fields.sex || null;
  const sumOnset = fields.dOnset || null;

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
      if (fields.ageYears === "") {
        err.ageYears = true;
        ok = false;
      }
      if (!fields.sex) {
        err.sex = true;
        ok = false;
      }
      if (!fields.municipality) {
        err.municipality = true;
        ok = false;
      }
      if (!fields.barangay) {
        err.barangay = true;
        ok = false;
      }
    }
    if (step === 3) {
      if (!fields.outcome) err.outcome = true;
      if (!fields.admitted) err.admitted = true;
      if (!fields.outcome || !fields.admitted) ok = false;
    }
    setFieldErr(err);
    if (!ok) showToast("⚠ Please complete all required fields before continuing.", "warning");
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

  const calcAgeFromDob = useCallback(() => {
    setFields((f) => {
      if (!f.dob) return f;
      const dob = new Date(`${f.dob}T12:00:00`);
      const today = new Date();
      if (Number.isNaN(dob.getTime())) return f;
      let years = today.getFullYear() - dob.getFullYear();
      const mo = today.getMonth() - dob.getMonth();
      if (mo < 0 || (mo === 0 && today.getDate() < dob.getDate())) years--;
      const days = Math.floor((today - dob) / 86400000);
      const totalMonths = Math.max(0, years * 12 + mo);
      return {
        ...f,
        ageYears: String(Math.max(0, years)),
        ageMonths: String(totalMonths),
        ageDays: String(Math.max(0, days))
      };
    });
  }, []);

  const updateBarangayOptions = useCallback((muni) => {
    setFields((f) => {
      const list = barangaysForMunicipality(muni);
      const nextBrgy = list.includes(f.barangay) ? f.barangay : list[0] || "";
      return { ...f, municipality: muni, barangay: nextBrgy };
    });
  }, []);

  const submitCase = async () => {
    if (!validateStep(1)) {
      goToStep(1);
      return;
    }
    if (!validateStep(2)) {
      goToStep(2);
      return;
    }
    if (!validateStep(3)) {
      goToStep(3);
      return;
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
        name: (fields.fullName || "").trim() || "Unnamed patient",
        age: fields.ageYears,
        sex: fields.sex,
        birthdate: fields.dob || null,
        civilStatus: null,
        province: user?.provinceName || user?.province || "Davao de Oro",
        municipality: fields.municipality,
        barangay: fields.barangay,
        purok: fields.streetPurok || null,
        birthplace: null,
        diseaseType,
        dateStarted: fields.dOnset,
        caseClassification: fields.caseClass || null,
        outcome: fields.outcome,
        patientNumber: (fields.patientNum || "").trim() || null,
        environment: {
          stagnantWater: !!fields.stagnantWater,
          recentRain: !!fields.recentRain,
          crowding: !!fields.crowding,
          washWater: fields.washWater || null,
          washSanitation: fields.washSanitation || null,
          floodHistory: !!fields.floodHistory,
          droughtHistory: !!fields.droughtHistory,
          exposureNotes: (fields.notes || "").trim() || null
        }
      };

      const data = await apiFetch("/patients", { token, method: "POST", body: payload });

      if (!fields.patientNum.trim() && data?.patientNumber) {
        setFields((f) => ({ ...f, patientNum: String(data.patientNumber) }));
      }

      setStepsCompleted((s) => {
        const next = [...s];
        next[5] = true;
        return next;
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PATIENTS_CHANGED_EVENT));
      }

      const ref =
        typeof data?.caseRef === "string"
          ? data.caseRef
          : `DDO-${fields.reportingYear || new Date().getFullYear()}-${data?.id ?? ""}`;
      setCaseRef(ref);
      setSuccessOpen(true);
    } catch (err) {
      showToast(err?.message ?? "Could not save case. Check your connection or database setup.", "warning");
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

  const outcomeNeedsDateDied = fields.outcome === "D";

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
                Enter case details accurately — this data feeds directly into the LSTM predictive model for outbreak
                forecasting.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm section-header-btn"
              onClick={() => setHistoryOpen(true)}
            >
              <IconClock />
              Recent Cases
            </button>
          </div>

          <div className="step-bar" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`step${currentStep > i ? " done" : ""}${currentStep === i ? " active" : ""}`}
              >
                <div className="step-inner">
                  <div className="step-circle">{i}</div>
                  <div className="step-label">
                    {["Disease", "Patient", "Clinical", "Environment", "Review"][i - 1]}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="form-layout">
            <div className="form-col">
              {/* Step 1 */}
              <div className={`step-page${currentStep === 1 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <div className="panel-title">Step 1 — Disease, dates & classification</div>
                    </div>
                    <span className="badge badge-info">
                      <span className="badge-dot" />
                      Required
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="alert-banner info" style={{ marginBottom: 20 }}>
                      <div className="alert-icon">ℹ️</div>
                      <div>
                        <div className="alert-title">Surveillance Diseases</div>
                        <div className="alert-body">
                          ALERTO monitors Dengue, Influenza-Like Illness (ILI), and Acute Watery Diarrhea (AWD). Select the
                          confirmed or suspected disease type for this case. The ICD-10 code will be auto-assigned.
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "rgba(194, 65, 12, 0.1)" }}>
                          🦟
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--dengue)" }}>
                            Select Disease
                          </div>
                          <div className="form-section-desc">Choose the disease type for this case report</div>
                        </div>
                      </div>
                      <div className="radio-cards">
                        {[
                          { v: "dengue", cls: "dengue", icon: "🦟", t: "Dengue", s: "ICD-10: A90–A91\nVector-borne" },
                          { v: "ili", cls: "ili", icon: "🤧", t: "ILI", s: "ICD-10: J10–J11\nRespiratory" },
                          { v: "awd", cls: "awd", icon: "💧", t: "AWD", s: "ICD-10: A00–A09\nGastrointestinal" }
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
                            <div className="radio-card-sub" style={{ whiteSpace: "pre-line" }}>
                              {d.s}
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className={`disease-error-inline${diseaseErr ? " visible" : ""}`}>
                        ⚠ Please select a disease type to continue.
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "var(--warning-dim)" }}>
                          📅
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--warning)" }}>
                            Dates
                          </div>
                          <div className="form-section-desc">
                            Enter date of onset first — morbidity week and month below follow from this date (you may
                            override them).
                          </div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="dOnset">
                            Date of Onset <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <FormDateInput
                            id="dOnset"
                            value={fields.dOnset}
                            error={!!fieldErr.dOnset}
                            onChange={(v) => {
                              const w = getWeekNumberForIsoDate(v);
                              const mo = v ? String(new Date(`${v}T12:00:00`).getMonth() + 1) : fields.morbMonth;
                              const yr = v ? String(new Date(`${v}T12:00:00`).getFullYear()) : fields.reportingYear;
                              setFields((f) => ({
                                ...f,
                                dOnset: v,
                                ...(w != null ? { morbWeek: String(w) } : {}),
                                ...(v ? { morbMonth: mo, reportingYear: yr } : {})
                              }));
                              clearErr(["dOnset"]);
                            }}
                          />
                          <div className="form-hint">DOnset — date symptoms first appeared</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="dAdmit">
                            Date Admitted / Consulted
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <FormDateInput
                            id="dAdmit"
                            value={fields.dAdmit}
                            onChange={(v) => setF({ dAdmit: v })}
                          />
                          <div className="form-hint">DAdmit — leave blank if outpatient</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="dEntry">
                            Date of Entry (Report) <span className="req">*</span>
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
                          <div className="form-hint">DateOfEntry — today by default</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="lagDisplayStep1">
                            Onset → Admit Lag <span className="lbl-tag">computed</span>
                          </label>
                          <input
                            id="lagDisplayStep1"
                            className="form-input"
                            type="text"
                            readOnly
                            value={lagText}
                            placeholder="— fill dates above —"
                            style={{ opacity: 0.75 }}
                          />
                          <div className="form-hint">OnsetToAdmit (days) — auto-calculated</div>
                        </div>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "var(--primary-dim)" }}>
                          📋
                        </div>
                        <div>
                          <div className="form-section-title">Case Classification</div>
                          <div className="form-section-desc">Based on diagnostic criteria at time of reporting</div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="caseClass">
                            Case Classification <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
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
                            <option value="">— Select classification —</option>
                            <option value="Suspect">Suspect</option>
                            <option value="Probable">Probable</option>
                            <option value="Confirmed">Confirmed</option>
                          </select>
                          <div className="form-hint">Based on clinical and lab criteria (CASECLASS field)</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="morbWeek">
                            Morbidity Week <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <input
                            id="morbWeek"
                            className="form-input"
                            type="number"
                            min={1}
                            max={53}
                            placeholder="e.g. 20"
                            value={fields.morbWeek}
                            onChange={(e) => setF({ morbWeek: e.target.value })}
                          />
                          <div className="form-hint">
                            Epidemiological week (MorbidityWeek) — auto-filled from Date of Onset; editable if needed
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="morbMonth">
                            Morbidity Month <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="morbMonth"
                            className="form-select"
                            value={fields.morbMonth}
                            onChange={(e) => setF({ morbMonth: e.target.value })}
                          >
                            <option value="">— Select month —</option>
                            {MONTH_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <div className="form-hint">
                            Calendar month (MorbidityMonth) — auto-filled from Date of Onset; editable if needed
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="reportingYear">
                            Reporting Year <span className="req">*</span>
                          </label>
                          <input
                            id="reportingYear"
                            className="form-input"
                            type="number"
                            min={2020}
                            max={2030}
                            value={fields.reportingYear}
                            onChange={(e) => setF({ reportingYear: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-nav">
                      <div />
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-primary" onClick={() => nextStep(1)}>
                          Next: Patient Info
                          <IconChevRight />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`step-page${currentStep === 2 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 2 — Patient Demographics</div>
                    <span className="badge badge-info">
                      <span className="badge-dot" />
                      Epidemiological Identifiers
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "var(--info-dim)" }}>
                          👤
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--ili)" }}>
                            Patient Identifiers
                          </div>
                          <div className="form-section-desc">
                            Used for record linkage. Full name is optional for privacy.
                          </div>
                        </div>
                      </div>
                      <div className="form-grid-2" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                          <label className="form-label" htmlFor="patientNum">
                            Patient Number / ID
                          </label>
                          <input
                            id="patientNum"
                            className="form-input"
                            type="text"
                            placeholder="e.g. 090 or leave blank"
                            value={fields.patientNum}
                            onChange={(e) => setF({ patientNum: e.target.value })}
                          />
                          <div className="form-hint">Facility-assigned number (PatientNumber field)</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="fullName">
                            Full Name <span style={{ color: "var(--text-xs)", fontWeight: 400 }}>(optional)</span>
                          </label>
                          <input
                            id="fullName"
                            className="form-input"
                            type="text"
                            placeholder="Last, First MI"
                            value={fields.fullName}
                            onChange={(e) => setF({ fullName: e.target.value })}
                          />
                          <div className="form-hint">For internal record only. Not used in model.</div>
                        </div>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "var(--primary-dim)" }}>
                          📊
                        </div>
                        <div>
                          <div className="form-section-title">Age & Sex</div>
                          <div className="form-section-desc">
                            Critical features for LSTM model — affects disease risk profile
                          </div>
                        </div>
                      </div>
                      <div className="form-grid-4">
                        <div className="form-group">
                          <label className="form-label" htmlFor="ageYears">
                            Age (Years) <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <input
                            id="ageYears"
                            className={`form-input${fieldErr.ageYears ? " error" : ""}`}
                            type="number"
                            min={0}
                            max={120}
                            placeholder="0"
                            value={fields.ageYears}
                            onChange={(e) => {
                              const v = e.target.value;
                              setFields((f) => {
                                if (v === "") return { ...f, ageYears: "", ageMonths: "", ageDays: "" };
                                const y = parseInt(v, 10) || 0;
                                return {
                                  ...f,
                                  ageYears: v,
                                  ageMonths: String(y * 12),
                                  ageDays: String(Math.round(y * 365.25))
                                };
                              });
                              clearErr(["ageYears"]);
                            }}
                          />
                          <div className="form-hint">AgeYears field</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="ageMonths">
                            Age (Months) <span className="lbl-tag">auto</span>
                          </label>
                          <input
                            id="ageMonths"
                            className="form-input"
                            type="number"
                            min={0}
                            max={1439}
                            placeholder="0"
                            value={fields.ageMonths}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const m = parseInt(raw, 10) || 0;
                              setFields((f) => ({
                                ...f,
                                ageMonths: raw,
                                ageYears: String(Math.floor(m / 12)),
                                ageDays: String(Math.round(m * 30.44))
                              }));
                            }}
                          />
                          <div className="form-hint">AgeMons — auto from years</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="ageDays">
                            Age (Days) <span className="lbl-tag">auto</span>
                          </label>
                          <input
                            id="ageDays"
                            className="form-input"
                            type="number"
                            placeholder="0"
                            readOnly
                            value={fields.ageDays}
                            style={{ opacity: 0.65 }}
                          />
                          <div className="form-hint">AgeDays — computed</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="sex">
                            Sex <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="sex"
                            className={`form-select${fieldErr.sex ? " error" : ""}`}
                            value={fields.sex}
                            onChange={(e) => {
                              setF({ sex: e.target.value });
                              clearErr(["sex"]);
                            }}
                          >
                            <option value="">— Select —</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                          </select>
                          <div className="form-hint">Sex field (M / F)</div>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: 14 }}>
                        <label className="form-label" htmlFor="dob">
                          Date of Birth <span style={{ color: "var(--text-xs)", fontWeight: 400 }}>(optional)</span>
                        </label>
                        <input
                          id="dob"
                          className="form-input"
                          type="date"
                          style={{ maxWidth: 220 }}
                          value={fields.dob}
                          onChange={(e) => setF({ dob: e.target.value })}
                          onBlur={calcAgeFromDob}
                        />
                        <div className="form-hint">DOB — if entered, age fields above are auto-filled</div>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "rgba(91, 33, 182, 0.1)" }}>
                          📍
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--awd)" }}>
                            Patient Address
                          </div>
                          <div className="form-section-desc">
                            Where the patient resides — geographic scope for model
                          </div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label">
                            Region <span className="lbl-tag">pre-filled</span>
                          </label>
                          <input className="form-input" value="Region XI – Davao" readOnly style={{ opacity: 0.65 }} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">
                            Province <span className="lbl-tag">pre-filled</span>
                          </label>
                          <input
                            className="form-input"
                            value={String(user?.province ?? "Davao de Oro")}
                            readOnly
                            style={{ opacity: 0.65 }}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="municipality">
                            Municipality/City <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="municipality"
                            className={`form-select${fieldErr.municipality ? " error" : ""}`}
                            value={fields.municipality}
                            onChange={(e) => {
                              updateBarangayOptions(e.target.value);
                              clearErr(["municipality", "barangay"]);
                            }}
                          >
                            <option value="">— Select municipality —</option>
                            {Object.keys(BARANGAY_BY_MUNICIPALITY).map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <div className="form-hint">MunicipalityOfDRU / Municipality field</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="barangay">
                            Barangay <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
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
                            <option value="">— Select barangay —</option>
                            {barangayOptions.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                          <div className="form-hint">Barangay field — auto-filtered by municipality</div>
                        </div>
                        <div className="form-group form-full">
                          <label className="form-label" htmlFor="streetPurok">
                            Street / Purok
                          </label>
                          <input
                            id="streetPurok"
                            className="form-input"
                            type="text"
                            placeholder="e.g. P-2, Purok Matobato"
                            value={fields.streetPurok}
                            onChange={(e) => setF({ streetPurok: e.target.value })}
                          />
                          <div className="form-hint">Streetpurok field — helps identify micro-geographic clusters</div>
                        </div>
                      </div>
                    </div>

                    <div className="form-nav">
                      <button type="button" className="btn btn-outline" onClick={() => prevStep(2)}>
                        <IconChevLeft />
                        Back
                      </button>
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-primary" onClick={() => nextStep(2)}>
                          Next: Clinical Details
                          <IconChevRight />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className={`step-page${currentStep === 3 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 3 — Clinical Details</div>
                    <span className="badge badge-warning">
                      <span className="badge-dot" />
                      Key LSTM Features
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "var(--danger-dim)" }}>
                          🏥
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--danger)" }}>
                            Admission & Outcome
                          </div>
                          <div className="form-section-desc">Admission status and case outcome are model features</div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="admitted">
                            Admitted to Hospital? <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="admitted"
                            className={`form-select${fieldErr.admitted ? " error" : ""}`}
                            value={fields.admitted}
                            onChange={(e) => {
                              setF({ admitted: e.target.value });
                              clearErr(["admitted"]);
                            }}
                          >
                            <option value="">— Select —</option>
                            <option value="0">No (Outpatient / RHU)</option>
                            <option value="1">Yes (Admitted)</option>
                          </select>
                          <div className="form-hint">Admitted field (0 = No, 1 = Yes)</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="facilityType">
                            Facility Type <span className="req">*</span>
                          </label>
                          <select
                            id="facilityType"
                            className="form-select"
                            value={fields.facilityType}
                            onChange={(e) => setF({ facilityType: e.target.value })}
                          >
                            <option value="RHU">RHU (Rural Health Unit)</option>
                            <option value="Government Hospital">Government Hospital</option>
                            <option value="Private Hospital">Private Hospital</option>
                            <option value="BHS">Barangay Health Station</option>
                          </select>
                          <div className="form-hint">TYPEHOSPITALCLINIC field</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="outcome">
                            Case Outcome <span className="req">*</span>
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="outcome"
                            className={`form-select${fieldErr.outcome ? " error" : ""}`}
                            value={fields.outcome}
                            onChange={(e) => {
                              setF({ outcome: e.target.value });
                              clearErr(["outcome"]);
                            }}
                          >
                            <option value="">— Select outcome —</option>
                            <option value="A">Alive / Recovered</option>
                            <option value="D">Died</option>
                          </select>
                          <div className="form-hint">Outcome field (A = Alive, D = Died)</div>
                        </div>
                        {outcomeNeedsDateDied ? (
                          <div className="form-group">
                            <label className="form-label" htmlFor="dateDied">
                              Date Died <span className="req">*</span>
                            </label>
                            <input
                              id="dateDied"
                              className="form-input"
                              type="date"
                              value={fields.dateDied}
                              onChange={(e) => setF({ dateDied: e.target.value })}
                            />
                            <div className="form-hint">DateDied — required if outcome is Died</div>
                          </div>
                        ) : null}
                        <div className="form-group">
                          <label className="form-label" htmlFor="labResult">
                            Lab Result
                            <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="labResult"
                            className="form-select"
                            value={fields.labResult}
                            onChange={(e) => setF({ labResult: e.target.value })}
                          >
                            <option value="Not Done">Not Done</option>
                            <option value="Positive">Positive</option>
                            <option value="Negative">Negative</option>
                            <option value="Pending">Pending</option>
                          </select>
                          <div className="form-hint">LabResult — diagnostic confirmation status</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="organism">
                            Organism (if positive)
                          </label>
                          <input
                            id="organism"
                            className="form-input"
                            type="text"
                            placeholder="e.g. Influenza A, Dengue DENV-2"
                            value={fields.organism}
                            onChange={(e) => setF({ organism: e.target.value })}
                          />
                          <div className="form-hint">Organism field — only if lab-confirmed</div>
                        </div>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "var(--info-dim)" }}>
                          🫁
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--ili)" }}>
                            ILI / SARI Flag
                          </div>
                          <div className="form-section-desc">Severe Acute Respiratory Illness — relevant for ILI cases</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <label className="check-row" style={{ flex: 1, minWidth: 200 }}>
                          <input
                            type="checkbox"
                            checked={fields.sariFlag}
                            onChange={(e) => setF({ sariFlag: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">Meets SARI Criteria</div>
                            <div className="check-row-sub">
                              SARI field — Severe Acute Respiratory Illness requiring hospitalization
                            </div>
                          </div>
                        </label>
                        <label className="check-row" style={{ flex: 1, minWidth: 200 }}>
                          <input
                            type="checkbox"
                            checked={fields.sentinelSite}
                            onChange={(e) => setF({ sentinelSite: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">Sentinel Site Case</div>
                            <div className="check-row-sub">SentinelSite — part of DOH sentinel surveillance program</div>
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
                          Next: Environmental
                          <IconChevRight />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className={`step-page${currentStep === 4 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 4 — Environmental Risk Factors</div>
                    <span className="badge badge-success">
                      <span className="badge-dot" />
                      Model Enhancement
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="alert-banner warning" style={{ marginBottom: 20 }}>
                      <div className="alert-icon">🌧</div>
                      <div>
                        <div className="alert-title">Why this matters</div>
                        <div className="alert-body">
                          Environmental factors (rainfall, temperature, WASH access) are primary drivers for Dengue, ILI,
                          and AWD. Reporting these improves the LSTM model&apos;s outbreak prediction accuracy for your
                          barangay.
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "rgba(194, 65, 12, 0.1)" }}>
                          🦟
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--dengue)" }}>
                            Vector / Dengue Risk
                          </div>
                          <div className="form-section-desc">Relevant for Dengue and ILI cases</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.stagnantWater}
                            onChange={(e) => setF({ stagnantWater: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">🌊 Stagnant Water Present Near Patient&apos;s Home</div>
                            <div className="check-row-sub">
                              Uncovered drums, containers, clogged canals — mosquito breeding sites
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
                            <div className="check-row-label">🌧 Heavy Rainfall in Past 2 Weeks</div>
                            <div className="check-row-sub">≥50mm over 7 days — creates new breeding habitats</div>
                          </div>
                        </label>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.crowding}
                            onChange={(e) => setF({ crowding: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">👥 Indoor Crowding / Poor Ventilation</div>
                            <div className="check-row-sub">Relevant for ILI — promotes airborne pathogen transmission</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "rgba(91, 33, 182, 0.1)" }}>
                          🚿
                        </div>
                        <div>
                          <div className="form-section-title" style={{ color: "var(--awd)" }}>
                            WASH (Water, Sanitation & Hygiene)
                          </div>
                          <div className="form-section-desc">Primary AWD risk predictor — also relevant for all diseases</div>
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-label" htmlFor="washWater">
                            Water Source Access <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="washWater"
                            className="form-select"
                            value={fields.washWater}
                            onChange={(e) => setF({ washWater: e.target.value })}
                          >
                            <option value="">— Select —</option>
                            <option value="piped">Piped / Level III</option>
                            <option value="shared">Shared / Level II</option>
                            <option value="unimproved">Unimproved (well, river)</option>
                            <option value="none">No access</option>
                          </select>
                          <div className="form-hint">Primary AWD risk indicator (WASH coverage)</div>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="washSanitation">
                            Sanitation / Toilet Access <span className="lbl-tag model">LSTM Input</span>
                          </label>
                          <select
                            id="washSanitation"
                            className="form-select"
                            value={fields.washSanitation}
                            onChange={(e) => setF({ washSanitation: e.target.value })}
                          >
                            <option value="">— Select —</option>
                            <option value="flush">Flush toilet (septic)</option>
                            <option value="pit">Pit latrine</option>
                            <option value="open">Open defecation</option>
                            <option value="none">No facility</option>
                          </select>
                          <div className="form-hint">Sanitation infrastructure — AWD risk factor</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.floodHistory}
                            onChange={(e) => setF({ floodHistory: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">🌊 Recent Flooding in Barangay</div>
                            <div className="check-row-sub">
                              Past 4 weeks — floods contaminate water sources and elevate AWD risk
                            </div>
                          </div>
                        </label>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={fields.droughtHistory}
                            onChange={(e) => setF({ droughtHistory: e.target.checked })}
                          />
                          <div>
                            <div className="check-row-label">☀️ Drought / Water Shortage</div>
                            <div className="check-row-sub">Forces use of unsafe water — AWD and typhoid risk factor</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <hr className="divider" />

                    <div className="form-section">
                      <div className="form-section-head">
                        <div className="form-section-icon" style={{ background: "var(--primary-dim)" }}>
                          📝
                        </div>
                        <div>
                          <div className="form-section-title">Additional Notes</div>
                          <div className="form-section-desc">Exposure history, travel, or other relevant context</div>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="notes">
                          Clinical / Exposure Notes
                        </label>
                        <textarea
                          id="notes"
                          className="form-textarea"
                          placeholder="Describe any recent travel, known contact with a case, cluster information, or other relevant details that may aid outbreak investigation..."
                          value={fields.notes}
                          onChange={(e) => setF({ notes: e.target.value })}
                        />
                        <div className="form-hint">Free-text — used for incident cause analysis</div>
                      </div>
                    </div>

                    <div className="form-nav">
                      <button type="button" className="btn btn-outline" onClick={() => prevStep(4)}>
                        <IconChevLeft />
                        Back
                      </button>
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-primary" onClick={() => nextStep(4)}>
                          Review & Submit
                          <IconChevRight />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className={`step-page${currentStep === 5 ? " active" : ""}`}>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">Step 5 — Review & Submit</div>
                    <span className="badge badge-success">
                      <span className="badge-dot" />
                      Final Check
                    </span>
                  </div>
                  <div className="panel-body lg">
                    <div className="alert-banner success" style={{ marginBottom: 20 }}>
                      <div className="alert-icon">✅</div>
                      <div>
                        <div className="alert-title">Ready to Submit</div>
                        <div className="alert-body">
                          Please review all fields before submitting. Once submitted, the case will be logged in the
                          provincial database and queued for LSTM model inference. Corrections can be made by contacting
                          MHO Mabini.
                        </div>
                      </div>
                    </div>

                    <div id="reviewSections">
                      <div style={{ marginBottom: 18 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "var(--text-xs)",
                              marginBottom: 10
                            }}
                          >
                            Disease Information
                          </div>
                          <div className="summary-grid">
                            <div className="summary-item">
                              <div className="summary-label">Disease Type</div>
                              <div className="summary-value" style={!fields.disease ? { color: "var(--text-xs)" } : undefined}>
                                {fields.disease ? NAME_MAP[fields.disease] : "—"}
                              </div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">ICD-10 Code</div>
                              <div className="summary-value" style={!fields.disease ? { color: "var(--text-xs)" } : undefined}>
                                {fields.disease ? ICD_MAP[fields.disease] : "—"}
                              </div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Date of Onset</div>
                              <div className="summary-value">{fields.dOnset || "—"}</div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Date of Entry (Report)</div>
                              <div className="summary-value">{fields.dEntry || "—"}</div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Case Classification</div>
                              <div className="summary-value">{fields.caseClass || "—"}</div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Morbidity Week / Month</div>
                              <div className="summary-value">
                                {fields.morbWeek && monthLabel ? `Week ${fields.morbWeek} · ${monthLabel}` : "—"}
                              </div>
                            </div>
                          </div>
                      </div>
                      <div style={{ marginBottom: 18 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "var(--text-xs)",
                              marginBottom: 10
                            }}
                          >
                            Patient Demographics
                          </div>
                          <div className="summary-grid">
                            <div className="summary-item">
                              <div className="summary-label">Age / Sex</div>
                              <div className="summary-value">
                                {fields.ageYears || fields.sex
                                  ? `${fields.ageYears || "?"} yrs / ${fields.sex || "?"}`
                                  : "—"}
                              </div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Municipality</div>
                              <div className="summary-value">{fields.municipality || "—"}</div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Barangay</div>
                              <div className="summary-value">{fields.barangay || "—"}</div>
                            </div>
                          </div>
                      </div>
                      <div style={{ marginBottom: 18 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              color: "var(--text-xs)",
                              marginBottom: 10
                            }}
                          >
                            Clinical Details
                          </div>
                          <div className="summary-grid">
                            <div className="summary-item">
                              <div className="summary-label">Admitted</div>
                              <div className="summary-value">
                                {fields.admitted === "0"
                                  ? "No (Outpatient)"
                                  : fields.admitted === "1"
                                    ? "Yes (Admitted)"
                                    : "—"}
                              </div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Outcome</div>
                              <div className="summary-value">
                                {fields.outcome === "A" ? "Alive / Recovered" : fields.outcome === "D" ? "Died" : "—"}
                              </div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Lab Result</div>
                              <div className="summary-value">{fields.labResult || "—"}</div>
                            </div>
                            <div className="summary-item">
                              <div className="summary-label">Onset → Admit Lag</div>
                              <div className="summary-value">{lagText || "—"}</div>
                            </div>
                          </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        padding: 16,
                        background: "var(--bg3)",
                        borderRadius: 10,
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--text-dim)"
                      }}
                    >
                      <strong style={{ color: "var(--text)" }}>Data certification:</strong> By submitting, I certify
                      that the information entered is accurate to the best of my knowledge and is based on actual
                      clinical consultation at BHU Brgy. {fields.barangay || "Cabuyuan"}, {fields.municipality || "Mabini"}. This
                      record will feed into the provincial ALERTO surveillance system.
                    </div>

                    <div className="form-nav">
                      <button type="button" className="btn btn-outline" onClick={() => prevStep(5)}>
                        <IconChevLeft />
                        Back
                      </button>
                      <div className="form-nav-right">
                        <button type="button" className="btn btn-outline btn-danger" onClick={confirmReset}>
                          Discard
                        </button>
                        <button type="button" className="btn btn-primary" disabled={submitting} onClick={submitCase}>
                          {submitting ? (
                            "Submitting..."
                          ) : (
                            <>
                              <IconCheck />
                              Submit Case Report
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="context-col">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Case Summary</div>
                  <span className="tag">Live Preview</span>
                </div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="summary-item">
                      <div className="summary-label">Disease</div>
                      <div className="summary-value">
                        {sumDisease ? (
                          sumDisease
                        ) : (
                          <span className="empty" style={{ color: "var(--text-xs)", fontStyle: "italic", fontWeight: 400 }}>
                            Not selected
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="summary-item">
                      <div className="summary-label">Date of Onset</div>
                      <div className="summary-value" style={!sumOnset ? { color: "var(--text-xs)", fontStyle: "italic", fontWeight: 400 } : undefined}>
                        {sumOnset || "—"}
                      </div>
                    </div>
                    <div className="summary-item">
                      <div className="summary-label">Week / Month</div>
                      <div className="summary-value" style={!sumMorb ? { color: "var(--text-xs)", fontStyle: "italic", fontWeight: 400 } : undefined}>
                        {sumMorb || "—"}
                      </div>
                    </div>
                    <div className="summary-item">
                      <div className="summary-label">Classification</div>
                      <div className="summary-value" style={!sumClass ? { color: "var(--text-xs)", fontStyle: "italic", fontWeight: 400 } : undefined}>
                        {sumClass || "—"}
                      </div>
                    </div>
                    <div className="summary-item">
                      <div className="summary-label">Municipality</div>
                      <div className="summary-value">{sumMuni}</div>
                    </div>
                    <div className="summary-item">
                      <div className="summary-label">Barangay</div>
                      <div className="summary-value">{sumBrgy}</div>
                    </div>
                    <div className="summary-item">
                      <div className="summary-label">Sex</div>
                      <div className="summary-value" style={!sumSex ? { color: "var(--text-xs)", fontStyle: "italic", fontWeight: 400 } : undefined}>
                        {sumSex || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">Form Progress</div>
                </div>
                <div className="panel-body" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginBottom: 8 }}>
                    <span>Completion</span>
                    <span style={{ color: "var(--primary)", fontWeight: 600 }}>{progressPct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
                    {[
                      "Disease, dates & classification",
                      "Patient Demographics",
                      "Clinical Details",
                      "Environmental Factors",
                      "Reviewed"
                    ].map((label, i) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          color: stepsCompleted[i + 1] ? "var(--primary)" : "var(--text-dim)"
                        }}
                      >
                        <span>{stepsCompleted[i + 1] ? "✅" : "⬜"}</span>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    Brgy. {fields.barangay || "Cabuyuan"} · Week {fields.morbWeek || "—"}
                  </div>
                </div>
                <div className="panel-body" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--dengue)",
                          display: "inline-block"
                        }}
                      />
                      Dengue
                    </span>
                    <strong style={{ color: "var(--dengue)" }}>3</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--ili)",
                          display: "inline-block"
                        }}
                      />
                      ILI
                    </span>
                    <strong style={{ color: "var(--ili)" }}>7</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--awd)",
                          display: "inline-block"
                        }}
                      />
                      AWD
                    </span>
                    <strong style={{ color: "var(--awd)" }}>2</strong>
                  </div>
                  <hr className="divider" style={{ margin: "6px 0" }} />
                  <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Target this week: 40 cases reviewed</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: "30%", background: "var(--warning)" }} />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--warning)" }}>12 / 40 — 70% below target</div>
                </div>
              </div>

              <div className="alert-banner info" style={{ margin: 0 }}>
                <div className="alert-icon">🤖</div>
                <div>
                  <div className="alert-title">LSTM Input Fields</div>
                  <div className="alert-body">
                    Fields tagged{" "}
                    <span
                      style={{
                        background: "var(--primary-dim)",
                        color: "var(--primary)",
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      LSTM INPUT
                    </span>{" "}
                    are used directly by the predictive model. Complete them accurately for best forecast quality.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${successOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="success-title">
        <div className="modal">
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div className="success-check">✓</div>
            <div id="success-title" style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 26, marginBottom: 10 }}>
              Case Submitted!
            </div>
            <div style={{ fontSize: 15, color: "var(--text-dim)", marginBottom: 22, lineHeight: 1.6 }}>
              Your case report has been logged in the ALERTO provincial database.
              <br />
              The LSTM model will process this data in the next scheduled inference run.
            </div>
            <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 18, marginBottom: 22, textAlign: "left" }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-xs)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}
              >
                Case Reference
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 16, color: "var(--primary)" }}>{caseRef}</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
                Brgy. {fields.barangay} · {fields.municipality} · Week {fields.morbWeek}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSuccessOpen(false);
                  resetForm();
                }}
              >
                Report Another
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

      <div
        className={`modal-overlay${historyOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hist-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) setHistoryOpen(false);
        }}
      >
        <div className="modal" style={{ width: 680 }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div id="hist-title" className="modal-title">
              Recent Cases · Brgy. {fields.barangay || "Cabuyuan"}
            </div>
            <button type="button" className="modal-close" onClick={() => setHistoryOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Disease</th>
                <th>Age/Sex</th>
                <th>Onset</th>
                <th>Week</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["DDO-2025-1284", "ILI", "10 / F", "May 11", "W20", "Active", "warning"],
                ["DDO-2025-1271", "ILI", "29 / M", "May 9", "W19", "Recovered", "success"],
                ["DDO-2025-1268", "Dengue", "34 / F", "May 7", "W19", "Recovered", "success"],
                ["DDO-2025-1240", "ILI", "3 / M", "Apr 30", "W18", "Recovered", "success"],
                ["DDO-2025-1222", "AWD", "2 / F", "Apr 26", "W17", "Recovered", "success"]
              ].map(([id, dis, ag, on, wk, out, badge]) => (
                <tr key={id}>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-dim)" }}>{id}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          dis === "Dengue"
                            ? "rgba(194, 65, 12, 0.12)"
                            : dis === "AWD"
                              ? "rgba(91, 33, 182, 0.12)"
                              : "rgba(29, 78, 216, 0.12)",
                        color: dis === "Dengue" ? "var(--dengue)" : dis === "AWD" ? "var(--awd)" : "var(--ili)"
                      }}
                    >
                      {dis}
                    </span>
                  </td>
                  <td>{ag}</td>
                  <td>{on}</td>
                  <td>{wk}</td>
                  <td>
                    <span className={`badge badge-${badge}`}>{out}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "14px 0 0", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setHistoryOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
