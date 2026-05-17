import { useEffect, useRef } from "react";
import "./LogoutConfirmModal.css";

function LogoutConfirmModal({ open, onCancel, onConfirm }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector("button")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="logout-modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="logout-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        aria-describedby="logout-modal-desc"
      >
        <h2 id="logout-modal-title" className="logout-modal-title">
          Sign out?
        </h2>
        <p id="logout-modal-desc" className="logout-modal-desc">
          You will need to sign in again to access the dashboard.
        </p>
        <div className="logout-modal-actions">
          <button type="button" className="logout-modal-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="logout-modal-btn danger" onClick={onConfirm}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmModal;
