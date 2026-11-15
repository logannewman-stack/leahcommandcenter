/**
 * A Stripe event, read as a moment on the board.
 *
 * Pure in the first half (`pulseFrom`), so the suite can hold every mapping
 * without Stripe or a database; the second half writes the row, once.
 *
 * ── What becomes a card ──────────────────────────────────────────────────
 *
 *   join          a subscription made (a 7 day trial, or a full membership
 *                 straight away for somebody who had a trial before)
 *   upgrade       a subscription that was trialing and is active now
 *   cancel        a membership set to end with its period, or ended now
 *   merch         a paid checkout from the Practice Club's shop (`kind: "shop"`)
 *   gift          a paid checkout marked `kind: "gift"` (a Payment Link for
 *                 the holiday gift carries that in its metadata)
 *
 * Team plans (`kind: "team"`), INQ enrollments and Academy courses are not
 * memberships and do not post. `source_id` is the subscription's or the
 * checkout's id with the kind, so the same moment told twice (a created
 * event and an updated event, or one event delivered twice) is one card.
 */

/** The events this endpoint asks Stripe for. */
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted"
];

const OPEN = new Set(["active", "trialing", "past_due"]);
const ENDED = new Set(["canceled", "incomplete_expired", "unpaid"]);

const iso = (seconds) => (seconds ? new Date(Number(seconds) * 1000).toISOString() : null);
const cityOf = (...values) => {
  for (const value of values) {
    const city = String(value || "").trim();
    if (city) return city.slice(0, 60);
  }
  return null;
};

/**
 * @param {any} event  a Stripe event
 * @returns {null | {
 *   kind: string, source_id: string, detail: Record<string, any>, big: boolean, quiet: boolean,
 *   customer: string, hint: string, email: string, nameHint: string, city: string|null,
 *   occurred_at: string, session?: string
 * }}
 */
export function pulseFrom(event) {
  const type = String(event?.type || "");
  const object = event?.data?.object || {};
  const previous = event?.data?.previous_attributes || {};
  const occurred_at = iso(event?.created) || new Date().toISOString();
  const customer = typeof object.customer === "string" ? object.customer : object.customer?.id || "";
  const metadata = object.metadata || {};

  if (type.startsWith("customer.subscription.")) {
    const sub = object;
    if (metadata.kind === "team") return null;
    const hint = String(metadata.user_id || "");
    const status = String(sub.status || "");
    const plan = String(metadata.plan || sub.items?.data?.[0]?.price?.recurring?.interval || "month");
    const base = { customer, hint, email: "", nameHint: "", city: null, occurred_at };

    if (type === "customer.subscription.deleted") {
      return { ...base, kind: "cancel", source_id: `${sub.id}:cancel`, detail: { at_period_end: false, plan }, big: false, quiet: true };
    }
    if (type === "customer.subscription.created") {
      if (status === "trialing") return { ...base, kind: "join", source_id: `${sub.id}:join`, detail: { trial: true, plan, trial_end: iso(sub.trial_end) }, big: false, quiet: false };
      if (OPEN.has(status)) return { ...base, kind: "join", source_id: `${sub.id}:join`, detail: { trial: false, plan }, big: false, quiet: false };
      return null;
    }
    // updated
    if (previous.status === "trialing" && status === "active") {
      return { ...base, kind: "upgrade", source_id: `${sub.id}:upgrade`, detail: { plan }, big: true, quiet: false };
    }
    if (previous.status === "incomplete" && OPEN.has(status)) {
      return { ...base, kind: "join", source_id: `${sub.id}:join`, detail: { trial: status === "trialing", plan, trial_end: iso(sub.trial_end) }, big: false, quiet: false };
    }
    if (sub.cancel_at_period_end === true && previous.cancel_at_period_end === false) {
      return { ...base, kind: "cancel", source_id: `${sub.id}:cancel`, detail: { at_period_end: true, ends: iso(sub.current_period_end), plan }, big: false, quiet: true };
    }
    if (ENDED.has(status) && previous.status && !ENDED.has(previous.status)) {
      return { ...base, kind: "cancel", source_id: `${sub.id}:cancel`, detail: { at_period_end: false, plan }, big: false, quiet: true };
    }
    return null;
  }

  if (type === "checkout.session.completed") {
    const session = object;
    if (session.payment_status !== "paid") return null;
    const kind = String(metadata.kind || (metadata.gift ? "gift" : ""));
    const email = String(session.customer_details?.email || session.customer_email || metadata.to_email || "").toLowerCase();
    const nameHint = String(metadata.to_name || session.customer_details?.name || "");
    const city = cityOf(metadata.to_city, session.customer_details?.address?.city, session.shipping_details?.address?.city);
    const amount = { amount_cents: Number(session.amount_total) || 0, currency: String(session.currency || "usd") };
    const base = { customer, hint: String(metadata.user_id || ""), email, nameHint, city, occurred_at, session: String(session.id || "") };
    if (kind === "shop") return { ...base, kind: "merch", source_id: `${session.id}:merch`, detail: { ...amount, items: [] }, big: false, quiet: false };
    if (kind === "gift") return { ...base, kind: "gift", source_id: `${session.id}:gift`, detail: { ...amount, item: String(metadata.item || "") }, big: true, quiet: false };
    return null;
  }

  return null;
}

/**
 * The row, written once. A second write of the same `source_id` is the
 * first row again, with `inserted: false`.
 *
 * @param {any} db
 * @param {Record<string, any>} row
 */
export async function recordPulse(db, row) {
  const { data, error } = await db.from("cc_pulse_events").insert(row).select().single();
  if (!error) return { inserted: true, row: data };
  if (error.code === "23505" && row.source_id) {
    const { data: existing } = await db.from("cc_pulse_events").select().eq("source_id", row.source_id).maybeSingle();
    return { inserted: false, row: existing };
  }
  throw new Error(`cc_pulse_events: ${error.message}`);
}

/** Today's, this month's and all-time counts of one kind, for the line in Discord. */
export async function countsFor(db, kind, now = new Date()) {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const count = async (since) => {
    let query = db.from("cc_pulse_events").select("id", { count: "exact", head: true }).eq("kind", kind);
    if (since) query = query.gte("occurred_at", since.toISOString());
    const { count: n } = await query;
    return Number(n) || 0;
  };
  const [today, thisMonth, total] = await Promise.all([count(day), count(month), count(null)]);
  return { today, month: thisMonth, total };
}
