import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Burst from "@/components/Burst";
import { chime } from "@/lib/sound";
import { supabase } from "@/lib/supabase";

const LiveContext = createContext(null);

const DAY = 24 * 60 * 60 * 1000;

/**
 * Everything that changes while the Command Center is open, in one place:
 *
 *   · one Realtime channel on `cc_pulse_events`, so "Live" beside the name
 *     is the truth and every screen hears a new moment the same instant;
 *   · the counts the sidebar badges and "Needs you" show, re-read on every
 *     moment and once a minute;
 *   · the month's burst and a soft chime for a loud moment, on whatever
 *     screen is open (a quiet one, a cancel or a trial ending, is neither).
 */
export function LiveProvider({ children }) {
  const [live, setLive] = useState(false);
  const [counts, setCounts] = useState({ cancels: 0, trialsEnding: 0, needsYou: 0, journeyFailed: 0, known: false });
  const [burst, setBurst] = useState(null);
  const listeners = useRef(new Set());

  const refreshCounts = useCallback(async () => {
    const quiet = (kind) =>
      supabase.from("cc_pulse_events").select("id", { count: "exact", head: true }).eq("kind", kind).eq("quiet", true).is("handled_at", null);
    const since = new Date(Date.now() - 14 * DAY).toISOString();
    const [cancels, trials, failed] = await Promise.all([
      quiet("cancel"),
      quiet("trial_ending"),
      supabase.from("cc_journey").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since)
    ]);
    if (cancels.error && trials.error) return;
    const next = {
      cancels: Number(cancels.count) || 0,
      trialsEnding: Number(trials.count) || 0,
      journeyFailed: Number(failed.count) || 0,
      known: true
    };
    next.needsYou = next.cancels + next.trialsEnding;
    setCounts(next);
  }, []);

  useEffect(() => {
    refreshCounts();
    const channel = supabase
      .channel("cc-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cc_pulse_events" }, (payload) => {
        const row = payload.new;
        if (!row) return;
        listeners.current.forEach((listen) => listen("insert", row));
        if (!row.quiet) {
          setBurst({ id: row.id, bigger: Boolean(row.big) });
          chime(Boolean(row.big));
        }
        refreshCounts();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cc_pulse_events" }, (payload) => {
        const row = payload.new;
        if (!row) return;
        listeners.current.forEach((listen) => listen("update", row));
        refreshCounts();
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const every = setInterval(refreshCounts, 60_000);
    return () => {
      clearInterval(every);
      supabase.removeChannel(channel);
    };
  }, [refreshCounts]);

  /** Hear each new or changed moment: `(type: "insert"|"update", row) => void`. Returns the unsubscribe. */
  const subscribe = useCallback((listen) => {
    listeners.current.add(listen);
    return () => listeners.current.delete(listen);
  }, []);

  const endBurst = useCallback(() => setBurst(null), []);
  /** The month's burst on demand: a checked to-do, a cleared list. */
  const celebrate = useCallback((bigger = false) => setBurst({ id: `c-${Date.now()}`, bigger }), []);
  const value = useMemo(() => ({ live, counts, refreshCounts, subscribe, celebrate }), [live, counts, refreshCounts, subscribe, celebrate]);
  return (
    <LiveContext.Provider value={value}>
      {children}
      <Burst burst={burst} onDone={endBurst} />
    </LiveContext.Provider>
  );
}

export function useLive() {
  return useContext(LiveContext);
}

/** Re-renders every `ms`, so "updated 2 min ago" ages while the screen sits open. */
export function useTick(ms = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Whether the window is wide enough for the sidebar. */
export function useWide() {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : true));
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const change = () => setWide(list.matches);
    list.addEventListener?.("change", change);
    return () => list.removeEventListener?.("change", change);
  }, []);
  return wide;
}

/** "updated just now" / "updated 12 min ago" / "updated 6:46 PM"; nothing before the first read. */
export function updatedLabel(at, now = Date.now()) {
  if (!at) return "";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "updated just now";
  if (seconds < 3600) return `updated ${Math.round(seconds / 60)} min ago`;
  return `updated ${new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
