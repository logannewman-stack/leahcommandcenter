import { useCallback, useEffect, useState } from "react";
import { useLive } from "@/lib/live";
import { supabase } from "@/lib/supabase";

/**
 * The latest moments of the kinds asked for, kept current by the shared
 * Realtime channel (src/lib/live.jsx): a new one is added at the top, a
 * changed one (handled, say) is changed in place.
 *
 * @param {{ limit?: number, kinds?: string[]|null }} [options]
 */
export function usePulse({ limit = 60, kinds = null } = {}) {
  const { subscribe } = useLive();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const kindsKey = kinds ? kinds.join(",") : "";

  const load = useCallback(async () => {
    let query = supabase.from("cc_pulse_events").select("*").order("occurred_at", { ascending: false }).limit(limit);
    if (kindsKey) query = query.in("kind", kindsKey.split(","));
    const { data, error: failed } = await query;
    if (failed) setError(failed.message);
    else {
      setError("");
      setEvents(data || []);
      setAt(Date.now());
    }
    setLoading(false);
  }, [limit, kindsKey]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(
    () =>
      subscribe((type, row) => {
        if (kindsKey && !kindsKey.split(",").includes(row.kind)) return;
        if (type === "insert") setEvents((now) => [row, ...now.filter((event) => event.id !== row.id)].slice(0, limit));
        else setEvents((now) => now.map((event) => (event.id === row.id ? { ...event, ...row } : event)));
        setAt(Date.now());
      }),
    [subscribe, kindsKey, limit]
  );

  const update = useCallback((id, patch) => setEvents((now) => now.map((event) => (event.id === id ? { ...event, ...patch } : event))), []);

  return { events, loading, error, at, reload: load, update };
}
