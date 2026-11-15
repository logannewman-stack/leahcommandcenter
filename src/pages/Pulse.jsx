import React, { useEffect, useState } from "react";
import Burst from "@/components/Burst";
import PulseCard from "@/components/PulseCard";
import { usePulse } from "@/lib/usePulse";
import { chime } from "@/lib/sound";

const FILTERS = [
  { id: "", label: "Everything" },
  { id: "join,upgrade", label: "Members" },
  { id: "merch,gift", label: "Shop" },
  { id: "trial_ending,cancel", label: "Needs you" }
];

/** The whole feed, with the four ways to look at it. */
export default function Pulse() {
  const [filter, setFilter] = useState("");
  const kinds = filter ? filter.split(",") : undefined;
  const { events, loading, error, arrived, clearArrived, update } = usePulse({ limit: 100, kinds });
  const [burst, setBurst] = useState(null);

  useEffect(() => {
    if (!arrived) return;
    if (!arrived.quiet) {
      setBurst({ id: arrived.id, bigger: Boolean(arrived.big) });
      chime(Boolean(arrived.big));
    }
    clearArrived();
  }, [arrived, clearArrived]);

  return (
    <div className="space-y-4">
      <Burst burst={burst} onDone={() => setBurst(null)} />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl mr-2">Live Pulse</h2>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${
              filter === item.id ? "bg-accent text-accent-ink border-accent" : "border-line-strong text-ink-muted hover:bg-canvas-sunken"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-danger">The feed didn't load: {error}</p> : null}
      {loading ? (
        <p className="text-sm text-ink-faint">Loading…</p>
      ) : events.length ? (
        <div className="grid gap-2.5 md:grid-cols-2">
          {events.map((event) => (
            <PulseCard key={event.id} event={event} onChange={update} />
          ))}
        </div>
      ) : (
        <p className="card p-6 text-sm text-ink-muted">Nothing here yet.</p>
      )}
    </div>
  );
}
