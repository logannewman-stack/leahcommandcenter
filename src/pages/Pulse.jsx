import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Plug } from "lucide-react";
import PulseRow from "@/components/PulseRow";
import { Card, Chip, EmptyState, Notice, Page, RefreshButton, Skeleton } from "@/components/ui";
import { VIEWS, viewOf } from "@/lib/kinds";
import { updatedLabel, useLive, useTick } from "@/lib/live";
import { usePulse } from "@/lib/usePulse";

const EMPTY = {
  all: ["Nothing on the board yet.", "The first join, upgrade or merch order lands here the second Stripe says so."],
  members: ["No joins or upgrades yet.", "Each new trial and each upgrade shows here as it happens."],
  shop: ["No merch or gifts yet.", "Orders from the Practice Club shop and holiday gifts show here."],
  needs: ["Nobody to reach right now.", "Cancellations and trials ending in 48 hours show here, with Handled."]
};

/** The whole feed, with the four ways to look at it in the URL (?view=needs). */
export default function Pulse() {
  const [params, setParams] = useSearchParams();
  const view = viewOf(params.get("view"));
  const { counts } = useLive();
  useTick(30_000);
  const { events, loading, error, at, reload, update } = usePulse({ limit: 100, kinds: view.kinds });
  const [spinning, setSpinning] = useState(false);

  const choose = (id) => {
    const next = new URLSearchParams(params);
    if (id === "all") next.delete("view");
    else next.set("view", id);
    setParams(next, { replace: true });
  };
  const refresh = async () => {
    setSpinning(true);
    await reload();
    setTimeout(() => setSpinning(false), 500);
  };

  const shown = view.id === "needs" ? [...events].sort((a, b) => Number(Boolean(a.handled_at)) - Number(Boolean(b.handled_at))) : events;
  const subtitle = [loading ? "" : `${events.length} moment${events.length === 1 ? "" : "s"}`, updatedLabel(at)].filter(Boolean).join(" · ");
  const [emptyTitle, emptySub] = EMPTY[view.id];

  return (
    <Page title="Live Pulse" subtitle={subtitle || "Every member moment as it happens"} right={<RefreshButton busy={spinning} onClick={refresh} />}>
      <nav className="cc-chips" aria-label="Show">
        {VIEWS.map((item) => (
          <Chip key={item.id} active={item.id === view.id} onClick={() => choose(item.id)} count={item.id === "needs" ? counts.needsYou : 0}>
            {item.label}
          </Chip>
        ))}
      </nav>
      {error ? (
        <Notice icon={Plug} title="The feed can't be read yet">
          {error}. Until the migration has run on the Practice's database, there is nothing to show.
        </Notice>
      ) : null}
      {loading ? (
        <Skeleton height={320} />
      ) : shown.length ? (
        <Card flush>
          <div className="cc-rows" style={{ padding: "0 8px" }}>
            {shown.map((event) => (
              <PulseRow key={event.id} event={event} onChange={update} />
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState icon={Activity} title={emptyTitle} sub={emptySub} />
        </Card>
      )}
    </Page>
  );
}
