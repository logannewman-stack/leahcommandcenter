import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).");
}

/**
 * The browser's client: the Practice's project, signed in as a person on the
 * team. Everything it reads is under row-level security (`cc_is_team()`).
 */
export const supabase = createClient(url || "http://localhost:54321", anonKey || "public-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
