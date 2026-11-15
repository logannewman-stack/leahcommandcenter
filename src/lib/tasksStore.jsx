import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ListPlus, PartyPopper, Trash2 } from "lucide-react";
import { callAdmin } from "@/lib/api";
import { useLive } from "@/lib/live";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { localISO, progressFor } from "@/lib/tasks";
import { useToast } from "@/lib/toast";

const TasksContext = createContext(null);

/** The tones a teammate's monogram and ring wear, by their place on the team list. */
export const PERSON_TONES = ["navy", "plum", "green", "amber", "gold", "rust"];

const DAY = 86_400_000;

/**
 * The team's to-dos, shared by the To-dos screen, the dashboard's cards and
 * the sidebar's badge.
 *
 * What each person holds is what the database lets them read: Leah (whoever
 * `assigns_tasks`) every to-do, everyone else their own. Open ones, and the
 * ones done in the last three weeks.
 *
 * Every change is drawn first and saved after, so a tap answers at once; a
 * save that fails puts the to-do back and says so. A Realtime channel keeps
 * it current: Leah sees a check-off the second it happens (with a note at
 * the bottom of the screen), and a teammate sees a new to-do the moment
 * Leah gives it.
 */
export function TasksProvider({ children }) {
  const { me, team } = useSession();
  const { celebrate } = useLive();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [at, setAt] = useState(0);
  const [today, setToday] = useState(localISO());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const email = me?.email || "";
  const lead = Boolean(me?.assigns_tasks);

  // The day turns over at midnight while the app sits open.
  useEffect(() => {
    const id = setInterval(() => setToday(localISO()), 60_000);
    return () => clearInterval(id);
  }, []);

  // The team, each with the tone their face and ring wear everywhere.
  const people = useMemo(
    () =>
      team
        .filter((p) => p.active !== false)
        .map((p, i) => ({ ...p, tone: PERSON_TONES[i % PERSON_TONES.length], lead: Boolean(p.assigns_tasks) })),
    [team]
  );
  const personOf = useCallback(
    (address) => {
      const person = people.find((p) => p.email === address);
      return person || { email: address, name: String(address || "").split("@")[0] || "Someone", tone: "ink", lead: false };
    },
    [people]
  );
  const personRef = useRef(personOf);
  personRef.current = personOf;

  const upsert = useCallback((row) => {
    if (!row?.id) return;
    setTasks((now) => {
      const i = now.findIndex((t) => t.id === row.id);
      if (i === -1) return [...now, row];
      const next = now.slice();
      next[i] = { ...now[i], ...row };
      return next;
    });
  }, []);
  const patch = useCallback((id, fields) => setTasks((now) => now.map((t) => (t.id === id ? { ...t, ...fields } : t))), []);
  const drop = useCallback((id) => setTasks((now) => now.filter((t) => t.id !== id)), []);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 21 * DAY).toISOString();
    const { data, error: failed } = await supabase
      .from("cc_tasks")
      .select("*")
      .or(`status.eq.open,done_at.gte.${since}`)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (failed) setError(failed.message);
    else {
      setError("");
      setTasks(data || []);
      setAt(Date.now());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!email) return undefined;
    load();
    const channel = supabase
      .channel("cc-tasks")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cc_tasks" }, ({ new: row }) => {
        if (!row) return;
        const before = tasksRef.current;
        // A to-do Leah just gave this person (not the next one of a repeating to-do they finished).
        const fresh = !before.some((t) => t.id === row.id || (t.series_id && t.series_id === row.series_id));
        // This person's own add arriving before its save answered: it takes the place of the draft.
        const draft = before.find((t) => t.pending && t.title === row.title && t.assignee_email === row.assignee_email);
        if (draft) setTasks((now) => now.filter((t) => t.id !== draft.id && t.id !== row.id).concat(row));
        else upsert(row);
        if (fresh && !draft && row.assignee_email === email && row.created_by !== email) {
          toast({ title: `${personRef.current(row.created_by).name} gave you a to-do`, body: row.title, icon: ListPlus, tone: "navy" });
        }
        setAt(Date.now());
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cc_tasks" }, ({ new: row }) => {
        if (!row) return;
        const before = tasksRef.current.find((t) => t.id === row.id);
        upsert(row);
        if (row.status === "done" && before && before.status !== "done" && row.done_by && row.done_by !== email) {
          toast({ title: `${personRef.current(row.done_by).name} finished a to-do`, body: row.title, icon: Check, tone: "green" });
        }
        setAt(Date.now());
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cc_tasks" }, ({ old }) => {
        if (old?.id) drop(old.id);
        setAt(Date.now());
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [email, load, upsert, drop, toast]);

  /** Done, or not done: the check, the burst, the note with Undo, and the save. */
  const setDone = useCallback(
    async (task, done) => {
      const before = tasksRef.current.find((t) => t.id === task.id) || task;
      if ((before.status === "done") === done) return true;
      const fields = done ? { status: "done", done_at: new Date().toISOString(), done_by: email } : { status: "open", done_at: null, done_by: null };
      patch(task.id, fields);

      if (done) {
        try {
          navigator.vibrate?.(12);
        } catch {
          // No haptics here: the check is enough.
        }
        const after = tasksRef.current.map((t) => (t.id === task.id ? { ...t, ...fields } : t));
        const mine = before.assignee_email === email;
        const day = progressFor(after, email, localISO());
        if (mine && day.left === 0 && day.done > 0) {
          celebrate(true);
          toast({ title: "You cleared today's list", body: "Every to-do due today is done.", icon: PartyPopper, tone: "gold" });
        } else {
          celebrate(false);
          toast({ title: "Done", body: before.title, icon: Check, tone: "green", action: { label: "Undo", onClick: () => setDoneRef.current(before, false) } });
        }
      }

      const { data, error: failed } = await supabase.rpc("cc_set_task_done", { task_id: task.id, done });
      if (failed) {
        patch(task.id, { status: before.status, done_at: before.done_at, done_by: before.done_by });
        toast({ title: "That didn't save", body: failed.message, icon: AlertCircle, tone: "rust" });
        return false;
      }
      if (data?.task) upsert(data.task);
      if (data?.next) upsert(data.next);
      if (data?.removed) drop(data.removed);
      // The check-off in #wins, once (the server checks it is real and new).
      if (done) callAdmin("checkoff", { method: "POST", body: { id: task.id } }).catch(() => {});
      return true;
    },
    [email, patch, upsert, drop, celebrate, toast]
  );
  const setDoneRef = useRef(setDone);
  setDoneRef.current = setDone;

  /** A new to-do (Leah). Drawn at once as a draft, swapped for the saved row. */
  const create = useCallback(
    async ({ title, notes = "", assignee_email, due_on = null, repeat = "none" }) => {
      const clean = String(title || "").trim();
      if (!clean || !assignee_email) return null;
      const draft = {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: clean,
        notes: notes || null,
        assignee_email,
        due_on,
        repeat,
        status: "open",
        created_by: email,
        sort_order: Date.now() / 1000,
        created_at: new Date().toISOString(),
        pending: true
      };
      setTasks((now) => [...now, draft]);
      const { data, error: failed } = await supabase
        .from("cc_tasks")
        .insert({ title: clean, notes: notes || null, assignee_email, due_on, repeat })
        .select()
        .single();
      if (failed) {
        drop(draft.id);
        toast({ title: "That to-do didn't save", body: failed.message, icon: AlertCircle, tone: "rust" });
        return null;
      }
      setTasks((now) => {
        const without = now.filter((t) => t.id !== draft.id && t.id !== data.id);
        return [...without, data];
      });
      return data;
    },
    [email, drop, toast]
  );

  /** A change to a to-do (Leah): title, notes, who, when, how often. */
  const update = useCallback(
    async (id, fields) => {
      const before = tasksRef.current.find((t) => t.id === id);
      if (!before) return null;
      patch(id, fields);
      const { data, error: failed } = await supabase.from("cc_tasks").update(fields).eq("id", id).select().single();
      if (failed) {
        upsert(before);
        toast({ title: "That change didn't save", body: failed.message, icon: AlertCircle, tone: "rust" });
        return null;
      }
      upsert(data);
      return data;
    },
    [patch, upsert, toast]
  );

  /** Gone (Leah), with Undo: putting it back makes it again. */
  const remove = useCallback(
    async (task) => {
      drop(task.id);
      const { error: failed } = await supabase.from("cc_tasks").delete().eq("id", task.id);
      if (failed) {
        upsert(task);
        toast({ title: "That didn't delete", body: failed.message, icon: AlertCircle, tone: "rust" });
        return false;
      }
      toast({
        title: "To-do deleted",
        body: task.title,
        icon: Trash2,
        tone: "ink",
        action: { label: "Undo", onClick: () => create({ title: task.title, notes: task.notes, assignee_email: task.assignee_email, due_on: task.due_on, repeat: task.repeat }) }
      });
      return true;
    },
    [drop, upsert, toast, create]
  );

  const mine = useMemo(() => tasks.filter((t) => t.assignee_email === email), [tasks, email]);
  const myDue = useMemo(() => mine.filter((t) => t.status === "open" && t.due_on && t.due_on <= today).length, [mine, today]);
  const overdue = useMemo(() => tasks.filter((t) => t.status === "open" && t.due_on && t.due_on < today).length, [tasks, today]);

  const value = useMemo(
    () => ({ tasks, mine, myDue, overdue, loading, error, at, today, lead, email, people, personOf, reload: load, setDone, create, update, remove }),
    [tasks, mine, myDue, overdue, loading, error, at, today, lead, email, people, personOf, load, setDone, create, update, remove]
  );
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  return useContext(TasksContext);
}
