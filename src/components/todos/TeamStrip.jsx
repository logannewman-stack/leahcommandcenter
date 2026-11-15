import React from "react";
import { Users } from "lucide-react";
import { Monogram, Ring } from "@/components/ui";
import { progressFor } from "@/lib/tasks";

/**
 * Leah's view of the team's day: everyone, then each person, with a ring
 * that fills as their to-dos due today get done. Tapping one shows only
 * theirs; Everyone shows them all.
 */
export default function TeamStrip({ tasks, people, today, value, onChange }) {
  const all = progressFor(tasks, null, today);
  const open = tasks.filter((t) => t.status === "open").length;
  return (
    <div className="cc-team-strip" role="radiogroup" aria-label="Whose to-dos">
      <button type="button" role="radio" aria-checked={value === "all"} className="cc-person cc-glass" onClick={() => onChange("all")}>
        <Ring value={all.ratio} size={46} stroke={4} tone="navy">
          <span className="cc-monogram tone-navy" style={{ width: 32, height: 32 }} aria-hidden="true">
            <Users size={16} strokeWidth={2.2} />
          </span>
        </Ring>
        <span className="min-w-0">
          <span className="t-sub t-strong cc-label cc-clip" style={{ display: "block" }}>
            Everyone
          </span>
          <span className="t-cap1 cc-tertiary cc-clip" style={{ display: "block" }}>
            {open} open · {all.done} done today
          </span>
        </span>
      </button>
      {people.map((person) => {
        const day = progressFor(tasks, person.email, today);
        const caption = day.total ? (day.left ? `${day.done} of ${day.total} today` : "All done today") : "Nothing due today";
        return (
          <button
            key={person.email}
            type="button"
            role="radio"
            aria-checked={value === person.email}
            className="cc-person cc-glass"
            onClick={() => onChange(person.email)}
          >
            <Ring value={day.total ? day.ratio : 0} size={46} stroke={4} tone={person.tone} label={`${person.name}: ${caption}`}>
              <Monogram name={person.name} tone={person.tone} size={32} />
            </Ring>
            <span className="min-w-0">
              <span className="t-sub t-strong cc-label cc-clip" style={{ display: "block" }}>
                {person.name}
              </span>
              <span className={`t-cap1 cc-clip ${day.total && !day.left ? "cc-done-text" : "cc-tertiary"}`} style={{ display: "block" }}>
                {caption}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
