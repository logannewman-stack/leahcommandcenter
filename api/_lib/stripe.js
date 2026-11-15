import crypto from "node:crypto";

/**
 * Stripe, through its own REST API, the way the Practice app reads it: a
 * signature check, a few GETs, no SDK. The API version is pinned so a change
 * to the account's default can never move a field this code reads.
 *
 *   STRIPE_SECRET_KEY      the account's secret key (the same account the Practice bills through)
 *   STRIPE_WEBHOOK_SECRET  this app's own endpoint's signing secret (whsec_…)
 */

const API = "https://api.stripe.com/v1";
export const STRIPE_VERSION = "2024-06-20";

export const stripeConfig = () => ({
  secret: process.env.STRIPE_SECRET_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ""
});

export const stripeOpen = () => Boolean(stripeConfig().secret);

export class StripeError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "StripeError";
    this.status = status;
  }
}

/** Nested params, form encoded as Stripe takes them: `{ a: { b: 1 } }` → `a[b]=1`. */
function encode(params, prefix = "", into = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params || {})) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((item, i) => (typeof item === "object" ? encode(item, `${name}[${i}]`, into) : into.append(`${name}[${i}]`, String(item))));
    else if (typeof value === "object") encode(value, name, into);
    else into.append(name, String(value));
  }
  return into;
}

/**
 * One request to Stripe. `fetcher` is handed in by the suite.
 *
 * @param {"GET"|"POST"|"DELETE"} method
 * @param {string} path
 * @param {Record<string, any>} [params]
 * @param {{ fetcher?: typeof fetch }} [options]
 */
export async function stripe(method, path, params = {}, { fetcher = fetch } = {}) {
  const { secret } = stripeConfig();
  if (!secret) throw new StripeError(503, "Stripe is not configured.");
  const query = method === "GET" ? encode(params).toString() : "";
  const response = await fetcher(`${API}${path}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      authorization: `Bearer ${secret}`,
      "stripe-version": STRIPE_VERSION,
      ...(method === "GET" ? {} : { "content-type": "application/x-www-form-urlencoded" })
    },
    body: method === "GET" ? undefined : encode(params).toString(),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new StripeError(response.status, data?.error?.message || `Stripe answered ${response.status}.`);
  return data;
}

/**
 * Whether a webhook body is Stripe's: the `Stripe-Signature` header's `v1`
 * is an HMAC-SHA256 of `${t}.${raw}` under the endpoint's secret, and `t`
 * is within tolerance (five minutes) of now.
 *
 * @param {Buffer|string} raw
 * @param {string} header
 * @param {string} secret
 */
export function verifySignature(raw, header, secret, { tolerance = 300, now = Date.now() } = {}) {
  if (!raw || !header || !secret) return false;
  let stamp = NaN;
  const signatures = [];
  for (const item of String(header).split(",")) {
    const at = item.indexOf("=");
    if (at === -1) continue;
    const key = item.slice(0, at).trim();
    const value = item.slice(at + 1).trim();
    if (key === "t") stamp = Number(value);
    else if (key === "v1" && /^[0-9a-f]+$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (!Number.isFinite(stamp) || !signatures.length) return false;
  if (Math.abs(now / 1000 - stamp) > tolerance) return false;
  const body = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), "utf8");
  const expected = crypto.createHmac("sha256", secret).update(`${stamp}.`).update(body).digest("hex");
  const want = Buffer.from(expected, "hex");
  return signatures.some((given) => {
    const have = Buffer.from(given, "hex");
    return have.length === want.length && crypto.timingSafeEqual(have, want);
  });
}

/** A signature header for a body, as Stripe would write it. For the suite and the Setup page's self-test. */
export function signFor(raw, secret, at = Math.floor(Date.now() / 1000)) {
  const body = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), "utf8");
  const v1 = crypto.createHmac("sha256", secret).update(`${at}.`).update(body).digest("hex");
  return `t=${at},v1=${v1}`;
}

/**
 * What a checkout bought, by name: "The Club Hoodie (Cream) / M × 2".
 *
 * @param {string} sessionId
 * @returns {Promise<{ name: string, quantity: number, amount_cents: number }[]>}
 */
export async function lineItemsOf(sessionId, { call = stripe } = {}) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId || ""))) return [];
  const list = await call("GET", `/checkout/sessions/${sessionId}/line_items`, { limit: 100 });
  return (list?.data || []).map((line) => ({
    name: String(line?.description || line?.price?.product?.name || "").trim(),
    quantity: Number(line?.quantity) || 1,
    amount_cents: Number(line?.amount_total) || 0
  }));
}

/**
 * A subscription's monthly worth, in cents: the price by the month, a yearly
 * one spread over twelve, times the seats.
 *
 * @param {any} subscription
 */
export function monthlyOf(subscription) {
  let cents = 0;
  for (const item of subscription?.items?.data || []) {
    const price = item?.price || {};
    const amount = Number(price.unit_amount) || 0;
    const quantity = Number(item?.quantity) || 1;
    const interval = price.recurring?.interval || "month";
    const count = Number(price.recurring?.interval_count) || 1;
    const perMonth = interval === "year" ? amount / (12 * count) : interval === "week" ? (amount * 52) / (12 * count) : interval === "day" ? (amount * 365) / (12 * count) : amount / count;
    cents += perMonth * quantity;
  }
  return Math.round(cents);
}

/**
 * Monthly recurring revenue, read from Stripe now: every active or past-due
 * subscription, a page at a time. Trials are counted but not added.
 *
 * @returns {Promise<{ mrr_cents: number, active_paying: number, trialing: number }>}
 */
export async function recurringNow({ call = stripe } = {}) {
  const totals = { mrr_cents: 0, active_paying: 0, trialing: 0 };
  for (const status of ["active", "past_due", "trialing"]) {
    let after = "";
    for (let page = 0; page < 50; page += 1) {
      const list = await call("GET", "/subscriptions", { status, limit: 100, ...(after ? { starting_after: after } : {}) });
      for (const subscription of list?.data || []) {
        if (status === "trialing") totals.trialing += 1;
        else {
          totals.active_paying += 1;
          totals.mrr_cents += monthlyOf(subscription);
        }
      }
      if (!list?.has_more || !list?.data?.length) break;
      after = list.data[list.data.length - 1].id;
    }
  }
  return totals;
}
