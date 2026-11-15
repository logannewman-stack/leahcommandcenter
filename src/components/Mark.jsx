import React from "react";

/** The Practice's mark, from its own icon, on a navy tile. */
export default function Mark({ size = 36, className = "" }) {
  return (
    <img
      src="/icon.svg"
      alt=""
      width={size}
      height={size}
      className={`rounded-[9px] ambient-gold ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
