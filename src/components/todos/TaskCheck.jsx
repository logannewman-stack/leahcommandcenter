import React from "react";

/**
 * The round check: an empty ring until it is tapped, then filled in the
 * accent with a check that draws itself and a small spring. A 44 px target
 * around a 26 px circle. A late one's ring is in the alert color.
 */
export default function TaskCheck({ done, late, title, onToggle, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={Boolean(done)}
      aria-label={done ? `Mark "${title}" not done` : `Mark "${title}" done`}
      className={`cc-check ${done ? "is-done" : ""} ${late && !done ? "is-late" : ""}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 12.5l3.6 3.6 7.4-8.2" />
      </svg>
    </button>
  );
}
