import { createClient } from "@supabase/supabase-js";

/**
 * Who is asking, and with what.
 *
 * The service-key client is the one thing here that can write the Command
 * Center's tables or read a member's contact details. It lives in this
 * process only; the browser signs in as a person and reads under row-level
 * security.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** The service-key client, or null where the key is not configured. */
export const admin = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

export const databaseConfigured = () => Boolean(admin);

/** Vercel sends the cron's secret as a bearer token; a person testing by hand may send it as a header. */
export function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const header = String(req.headers?.authorization || "");
  const given = header.startsWith("Bearer ") ? header.slice(7) : String(req.headers?.["x-cron-secret"] || "");
  return Boolean(given) && given === secret;
}

/** The bearer token on a request from the browser: the person's Supabase session. */
const tokenOf = (req) => {
  const header = String(req.headers?.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

/**
 * The signed-in person, from their session token, or null.
 * @returns {Promise<{ id: string, email: string }|null>}
 */
export async function identify(req) {
  const token = tokenOf(req);
  if (!token || !admin) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.email) return null;
    return { id: data.user.id, email: String(data.user.email).toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * The signed-in person's row on the team, or null: the server's own check,
 * the same one `cc_is_team()` makes for the browser.
 *
 * @returns {Promise<{ email: string, name: string, lane: string|null, is_admin: boolean }|null>}
 */
export async function teamMember(req) {
  const who = await identify(req);
  if (!who) return null;
  const { data } = await admin.from("cc_team").select("email, name, lane, is_admin, active").eq("email", who.email).maybeSingle();
  return data?.active ? { email: data.email, name: data.name, lane: data.lane, is_admin: Boolean(data.is_admin), id: who.id } : null;
}

/** The one settings row, with its defaults where the table is not there yet. */
export async function settingsOf(db) {
  const fallback = { journey_enabled: true, texting_enabled: false, discord_wins_enabled: true, sender: "Leah", gift_goal: 0 };
  if (!db) return fallback;
  const { data } = await db.from("cc_settings").select("*").eq("id", true).maybeSingle();
  return { ...fallback, ...(data || {}) };
}

const BODY_LIMIT = 100_000;

/** The request's JSON body as an object, whichever shape the platform hands it over in. */
export function readJsonBody(req, { limit = BODY_LIMIT } = {}) {
  const asObject = (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    throw new Error("Expected a JSON object");
  };
  const parseText = (text) => {
    if (text.length > limit) throw new Error("Request body too large");
    return asObject(text ? JSON.parse(text) : {});
  };
  if (Object.prototype.hasOwnProperty.call(req, "body") || req.body !== undefined) {
    try {
      const body = req.body;
      if (typeof body === "string") return Promise.resolve(parseText(body));
      if (Buffer.isBuffer(body)) return Promise.resolve(parseText(body.toString("utf8")));
      if (body === undefined || body === null || body === "") return Promise.resolve({});
      return Promise.resolve(asObject(body));
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > limit) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(parseText(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

/** The body exactly as it arrived, for a signature check; and parsed, either way. */
export async function readRawBody(req) {
  const parse = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };
  if (typeof req.on === "function" && req.readableEnded === false && req.body === undefined) {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks);
    return { raw, parsed: parse(raw.toString("utf8")) };
  }
  let body;
  try {
    body = req.body;
  } catch {
    return { raw: null, parsed: null };
  }
  if (typeof body === "string") return { raw: body, parsed: parse(body) };
  if (Buffer.isBuffer(body)) return { raw: body, parsed: parse(body.toString("utf8")) };
  return { raw: null, parsed: body && typeof body === "object" ? body : null };
}

/** This deployment's own address, for links back to the Command Center. */
export function appOrigin(req) {
  const set = String(process.env.APP_URL || "").replace(/\/+$/, "");
  if (/^https?:\/\//.test(set)) return set;
  const forwarded = req?.headers?.["x-forwarded-host"];
  const host = String((Array.isArray(forwarded) ? forwarded[0] : forwarded) || req?.headers?.host || "").split(",")[0].trim();
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return "";
  return `${/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) ? "http" : "https"}://${host}`;
}

/** Where members are: the Practice app. */
export const practiceUrl = () => String(process.env.PRACTICE_URL || "https://www.practiceinnerboard.com").replace(/\/+$/, "");
