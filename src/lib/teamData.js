import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { callAdmin } from "@/lib/api";

/**
 * The team's own records beyond the to-dos: thank yous, Leah's morning
 * message, the Dream Board's goals, the cities, member moments and the daily
 * log. Each reads under row-level security and stays live where it matters.
 */

const pad = (n) => String(n).padStart(2, "0");
/** A Date's local day, "YYYY-MM-DD". */
export const dayOf = (at = new Date()) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/** Thank yous, newest first, live. */
export function useShoutouts(limit = 60) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from("cc_shoutouts").select("*").order("created_at", { ascending: false }).limit(limit);
    setRows(data || []);
    setLoading(false);
  }, [limit]);
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`cc_thanks_live_${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cc_shoutouts" }, (payload) => {
        if (payload.new) setRows((now) => (now.some((r) => r.id === payload.new.id) ? now : [payload.new, ...now].slice(0, limit)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cc_shoutouts" }, (payload) => {
        if (payload.old?.id) setRows((now) => now.filter((r) => r.id !== payload.old.id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, limit]);

  const thank = useCallback(async ({ to, message, taskId }) => {
    const { data, error } = await supabase
      .from("cc_shoutouts")
      .insert({ to_email: to, message: String(message || "").trim(), task_id: taskId || null })
      .select()
      .single();
    if (error) return error.message;
    setRows((now) => (now.some((r) => r.id === data.id) ? now : [data, ...now]));
    return "";
  }, []);

  const takeBack = useCallback(async (id) => {
    const { error } = await supabase.from("cc_shoutouts").delete().eq("id", id);
    if (error) return error.message;
    setRows((now) => now.filter((r) => r.id !== id));
    return "";
  }, []);

  return { rows, loading, thank, takeBack, reload: load };
}

/** The morning message: today's, or the last one before it. */

/** The morning message: today's, or the last one before it. */
export function useMorningNote() {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = dayOf();
  const load = useCallback(async () => {
    const { data } = await supabase.from("cc_notes").select("*").lte("for_date", today).order("for_date", { ascending: false }).limit(1);
    setNote(data?.[0] || null);
    setLoading(false);
  }, [today]);
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`cc_notes_live_${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_notes" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);
  const write = useCallback(
    async (forDate, body) => {
      const { error } = await supabase.from("cc_notes").upsert({ for_date: forDate, body: String(body || "").trim() }, { onConflict: "for_date" });
      if (error) return error.message;
      await load();
      return "";
    },
    [load]
  );
  return { note, today, loading, write };
}

/** Leah's goals, in her order. */

/** Leah's goals, in her order. */
export function useGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from("cc_goals").select("*").order("sort").order("created_at");
    setGoals(data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const save = useCallback(
    async (goal, id) => {
      const { error } = id ? await supabase.from("cc_goals").update(goal).eq("id", id) : await supabase.from("cc_goals").insert(goal);
      if (error) return error.message;
      await load();
      return "";
    },
    [load]
  );
  const remove = useCallback(
    async (id) => {
      const { error } = await supabase.from("cc_goals").delete().eq("id", id);
      if (error) return error.message;
      await load();
      return "";
    },
    [load]
  );
  return { goals, loading, save, remove };
}

/** Where the movement is: cities, as counts. */

/** Where the movement is: cities, as counts. */
export function useCities() {
  const [cities, setCities] = useState([]);
  useEffect(() => {
    supabase.rpc("cc_cities").then(({ data }) => setCities(data || []));
  }, []);
  return cities;
}

/** Members' 30 day, 90 day and one year marks coming up: first names only, from the server. */

/** Members' 30 day, 90 day and one year marks coming up: first names only, from the server. */
export function useMoments() {
  const [moments, setMoments] = useState(null);
  useEffect(() => {
    callAdmin("moments")
      .then((got) => setMoments(got?.moments || []))
      .catch(() => setMoments([]));
  }, []);
  return moments;
}

/**
 * The daily log: "what I got done today", one line each, live. `from` and
 * `to` are days ("YYYY-MM-DD"); one day by default.
 */

/**
 * The daily log: "what I got done today", one line each, live. `from` and
 * `to` are days ("YYYY-MM-DD"); one day by default.
 */
export function useLogs(from = dayOf(), to = from) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from("cc_logs").select("*").gte("on_date", from).lte("on_date", to).order("created_at", { ascending: true });
    setLogs(data || []);
    setLoading(false);
  }, [from, to]);
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`cc_logs_live_${from}_${to}_${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_logs" }, (payload) => {
        if (payload.eventType === "DELETE" && payload.old?.id) setLogs((now) => now.filter((r) => r.id !== payload.old.id));
        else if (payload.new?.id && payload.new.on_date >= from && payload.new.on_date <= to)
          setLogs((now) => (now.some((r) => r.id === payload.new.id) ? now.map((r) => (r.id === payload.new.id ? payload.new : r)) : [...now, payload.new]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, from, to]);

  const add = useCallback(
    async (body, onDate = from) => {
      const text = String(body || "").trim();
      if (!text) return "Say what you got done.";
      const { data, error } = await supabase.from("cc_logs").insert({ body: text.slice(0, 500), on_date: onDate }).select().single();
      if (error) return error.message;
      setLogs((now) => (now.some((r) => r.id === data.id) ? now : [...now, data]));
      return "";
    },
    [from]
  );
  const remove = useCallback(async (id) => {
    const { error } = await supabase.from("cc_logs").delete().eq("id", id);
    if (error) return error.message;
    setLogs((now) => now.filter((r) => r.id !== id));
    return "";
  }, []);
  return { logs, loading, add, remove };
}

