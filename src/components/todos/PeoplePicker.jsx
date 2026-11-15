import React from "react";
import { Monogram } from "@/components/ui";

/** Who a to-do is for: the team as a row of faces, one picked. */
export default function PeoplePicker({ people, value, onChange, label = "Assign to" }) {
  return (
    <div className="cc-people" role="radiogroup" aria-label={label}>
      {people.map((person) => (
        <button
          key={person.email}
          type="button"
          role="radio"
          aria-checked={person.email === value}
          className="cc-person-pick"
          onClick={() => onChange(person.email)}
        >
          <Monogram name={person.name} tone={person.tone} size={38} />
          <span className="cc-clip">{person.name}</span>
        </button>
      ))}
    </div>
  );
}
