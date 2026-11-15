import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { money, percent } from "@/lib/format";

/**
 * "A simple top row of numbers on the Command Center home screen." One read,
 * `cc_scoreboard()`: counts only. Referrals and team tasks arrive with their
 * phases and read 0 until then.
 */
export default function Scoreboard({ refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.rpc("cc_scoreboard").then(({ data: got, error: failed }) => {
      if (!alive) return;
      if (failed) setError(failed.message);
      else setData(got);
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (error) return <p className="text-sm text-danger">The scoreboard didn't load: {error}</p>;
  const s = data || {};
  const tiles = [
    { label: "New trials", value: s.trials_week ?? "–", sub: `${s.trials_month ?? "–"} this month` },
    { label: "Trial to paid", value: percent(s.cohort_converted, s.cohort_joins), sub: `${s.cohort_converted ?? 0} of ${s.cohort_joins ?? 0} trials` },
    { label: "Paying members", value: s.active_paying ?? "–", sub: s.mrr_cents ? `${money(s.mrr_cents)} a month` : `${s.trialing ?? 0} on trial` },
    { label: "Merch this month", value: money(s.merch_month_cents || 0), sub: `${s.merch_month_orders ?? 0} order${s.merch_month_orders === 1 ? "" : "s"}` },
    { label: "Used the app, 7 days", value: s.active_7d ?? "–", sub: `${s.members_total ?? "–"} accounts` },
    { label: "Gifts", value: s.gifts_total ?? 0, sub: `${s.gifts_month ?? 0} this month` },
    { label: "Referrals", value: "–", sub: "Phase 3" },
    { label: "Team tasks this week", value: "–", sub: "Phase 2" }
  ];
  return (
    <section aria-label="Scoreboard">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {tiles.map((tile) => (
          <div key={tile.label} className="card px-4 py-3">
            <p className="eyebrow">{tile.label}</p>
            <p className="mt-1 font-display text-[28px] leading-none text-ink">{data ? tile.value : <span className="inline-block w-10 h-6 rounded bg-canvas-sunken animate-pulse" />}</p>
            <p className="mt-1 text-xs text-ink-faint">{tile.sub}</p>
          </div>
        ))}
      </div>
      {Array.isArray(s.top_items) && s.top_items.length ? (
        <p className="mt-2 text-xs text-ink-faint">
          Selling this month: {s.top_items.map((item) => `${item.name} (${item.count})`).join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
