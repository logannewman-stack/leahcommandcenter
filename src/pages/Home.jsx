import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Burst from "@/components/Burst";
import PulseCard from "@/components/PulseCard";
import Scoreboard from "@/components/Scoreboard";
import { usePulse } from "@/lib/usePulse";
import { chime } from "@/lib/sound";
import { seasonFor } from "@/lib/seasons";

/**
 * The home screen: the numbers across the top, what needs a person, and the
 * Live Pulse. A moment that lands while the screen is open is the month's
 * burst and a soft chime; a quiet one is neither.
 */
export default function Home() {
  const { events, loading, error, arrived, clearArrived, update } = usePulse({ limit: 20 });
  const [burst, setBurst] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!arrived) return;
    if (!arrived.quiet) {
      setBurst({ id: arrived.id, bigger: Boolean(arrived.big) });
      chime(Boolean(arrived.big));
    }
    setRefreshKey((n) => n + 1);
    clearArrived();
  }, [arrived, clearArrived]);

  const needsYou = useMemo(() => events.filter((event) => event.quiet && !event.handled_at), [events]);
  const season = seasonFor();

  return (
    <div className="space-y-8">
      <Burst burst={burst} onDone={() => setBurst(null)} />
      <Scoreboard refreshKey={refreshKey} />

      {needsYou.length ? (
        <section className="space-y-3" aria-label="Needs you">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Needs you</h2>
            <span className="text-xs text-ink-faint">Quiet cards: a note from a person means something here.</span>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            {needsYou.map((event) => (
              <PulseCard key={event.id} event={event} onChange={update} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-label="Live Pulse">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Live Pulse</h2>
          <Link to="/pulse" className="text-sm text-accent underline underline-offset-2">
            Everything
          </Link>
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
          <div className="card p-6 text-sm text-ink-muted">
            Nothing yet. The first join, upgrade or merch order lands here the moment Stripe tells us, with {season.month}'s {season.motif.toLowerCase()}.
            {" "}
            <Link to="/setup" className="text-accent underline underline-offset-2">
              Check Setup
            </Link>{" "}
            to see what is connected.
          </div>
        )}
      </section>
    </div>
  );
}
