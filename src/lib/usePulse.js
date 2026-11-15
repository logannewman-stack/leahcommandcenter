import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * The Live Pulse: the latest moments, and each new one the instant the server
 * writes it (Supabase Realtime on `cc_pulse_events`; the select policy decides
 * who hears it).
 *
 * `arrived` is the newest row that came in live, for the burst and the sound;
 * a screen reads it once and calls `clearArrived`.
 *
 * @param {{ limit?: number, kinds?: string[] }} [options]
 */
export function usePulse({ limit = 30, kinds } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [arrived, setArrived] = useState(null);
  const kindsKey = kinds ? kinds.join(",") : "";
  const seen = useRef(new Set());

  const load = useCallback(async () => {
    let query = supabase.from("cc_pulse_events").select("*").order("occurred_at", { ascending: false }).limit(limit);
    if (kindsKey) query = query.in("kind", kindsKey.split(","));
    const { data, error: failed } = await query;
    if (failed) setError(failed.message);
    else {
      setEvents(data || []);
      seen.current = new Set((data || []).map((row) => row.id));
    }
    setLoading(false);
  }, [limit, kindsKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("cc_pulse_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cc_pulse_events" }, (payload) => {
        const row = payload.new;
        if (!row || seen.current.has(row.id)) return;
        if (kindsKey && !kindsKey.split(",").includes(row.kind)) return;
        seen.current.add(row.id);
        setEvents((now) => [row, ...now].slice(0, limit));
        setArrived(row);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cc_pulse_events" }, (payload) => {
        const row = payload.new;
        if (!row) return;
        setEvents((now) => now.map((event) => (event.id === row.id ? { ...event, ...row } : event)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, kindsKey]);

  const update = useCallback((id, patch) => setEvents((now) => now.map((event) => (event.id === id ? { ...event, ...patch } : event))), []);

  return { events, loading, error, arrived, clearArrived: () => setArrived(null), reload: load, update };
}
