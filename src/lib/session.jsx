import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const SessionContext = createContext(null);

/**
 * Who is signed in, and whether they are on the team.
 *
 * `me` is the person's own `cc_team` row, read under row-level security: a
 * member of the Practice who is not on the team reads no row at all, and
 * sees the "not on the team yet" screen rather than any data.
 */
export function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(undefined);
  const [team, setTeam] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => alive && setSession(next || null));
    return () => {
      alive = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const load = useCallback(async (current) => {
    if (!current?.user?.email) {
      setMe(null);
      setTeam([]);
      setSettings(null);
      return;
    }
    const email = String(current.user.email).toLowerCase();
    const [{ data: rows }, { data: row }] = await Promise.all([
      supabase.from("cc_team").select("*").order("name"),
      supabase.from("cc_settings").select("*").eq("id", true).maybeSingle()
    ]);
    const list = rows || [];
    setTeam(list);
    setMe(list.find((person) => person.email === email) || null);
    setSettings(row || null);
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    load(session);
  }, [session, load]);

  const value = useMemo(
    () => ({
      loading: session === undefined || (Boolean(session) && me === undefined),
      session,
      user: session?.user || null,
      me,
      team,
      settings,
      refresh: () => load(session),
      signOut: () => supabase.auth.signOut()
    }),
    [session, me, team, settings, load]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
