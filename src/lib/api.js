import { supabase } from "@/lib/supabase";

/**
 * A call to this app's own server (`api/admin.js`), as the signed-in person.
 *
 * @param {string} op
 * @param {{ method?: string, body?: any, query?: Record<string, string> }} [options]
 */
export async function callAdmin(op, { method = "GET", body, query = {} } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  const params = new URLSearchParams({ op, ...query });
  const response = await fetch(`/api/admin?${params}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(json?.error || `The server answered ${response.status}.`);
    error.status = response.status;
    error.body = json;
    throw error;
  }
  return json;
}
