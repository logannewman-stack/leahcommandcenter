import { memberByEmail } from "./members.js";
import { pulseFrom, recordPulse } from "./pulse.js";
import { lineItemsOf, stripe, stripeOpen } from "./stripe.js";
import { firstNameOf } from "./words.js";

/**
 * Merch orders and gifts the Live Pulse never heard about, read back from
 * Stripe.
 *
 * The board learns of a sale from Stripe's webhook (`api/stripe.js`) the
 * moment it is paid. An order paid before that endpoint existed, or one
 * whose event never arrived, was missing, so "Merch this month" read $0
 * while Printful was shipping orders (Logan, November 15). This reads every
 * paid checkout in the window from Stripe itself and writes the ones the
 * board does not have, as the webhook would have: the same card, the same
 * `source_id`, so a later webhook for the same order is still one card.
 *
 * A caught-up order is history, not news: no line in #wins, no thank-you
 * email (the Practice app already sent the buyer theirs), and the board
 * does not celebrate it (`src/lib/live.jsx` celebrates only fresh moments).
 */

const DAY = 86_400_000;
const PAGES = 10;

/** The first of last month: enough for "this month" and the month before it. */
export function defaultSince(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
}

/**
 * @param {any} db  the service-key client
 * @param {{ since?: number, now?: Date, call?: typeof stripe, items?: typeof lineItemsOf, byEmail?: typeof memberByEmail, record?: typeof recordPulse }} [options]
 * @returns {Promise<{ checked: number, added: number, skipped?: string }>}
 */
export async function catchUpSales(db, { since, now = new Date(), call = stripe, items = lineItemsOf, byEmail = memberByEmail, record = recordPulse } = {}) {
  if (!db) return { checked: 0, added: 0, skipped: "no_database" };
  if (call === stripe && !stripeOpen()) return { checked: 0, added: 0, skipped: "no_stripe" };
  const from = Math.floor((since ?? defaultSince(now)) / 1000);

  // Every complete checkout in the window that is a merch order or a gift.
  const moments = [];
  let checked = 0;
  let after = "";
  for (let page = 0; page < PAGES; page += 1) {
    const list = await call("GET", "/checkout/sessions", { limit: 100, status: "complete", created: { gte: from }, ...(after ? { starting_after: after } : {}) });
    const data = list?.data || [];
    for (const session of data) {
      checked += 1;
      const moment = pulseFrom({ type: "checkout.session.completed", created: session.created, data: { object: session } });
      if (moment && (moment.kind === "merch" || moment.kind === "gift")) moments.push({ moment, session });
    }
    if (!list?.has_more || !data.length) break;
    after = data[data.length - 1].id;
  }
  if (!moments.length) return { checked, added: 0 };

  // The ones the board already has, in one read.
  const ids = moments.map(({ moment }) => moment.source_id);
  const known = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("cc_pulse_events").select("source_id").in("source_id", ids.slice(i, i + 200));
    if (error) throw new Error(`cc_pulse_events: ${error.message}`);
    for (const row of data || []) known.add(row.source_id);
  }

  let added = 0;
  for (const { moment, session } of moments) {
    if (known.has(moment.source_id)) continue;
    const member = moment.email ? await byEmail(db, moment.email).catch(() => null) : null;
    const detail = { ...moment.detail };
    try {
      const lines = await items(session.id);
      if (moment.kind === "merch") detail.items = lines.map(({ name, quantity }) => ({ name, quantity }));
      else if (!detail.item) detail.item = lines.map((line) => line.name).filter(Boolean).join(", ");
    } catch {
      // The order still counts without its item names.
    }
    const { inserted } = await record(db, {
      kind: moment.kind,
      user_id: member?.userId || null,
      first_name: member?.firstName || firstNameOf(moment.nameHint),
      city: moment.city,
      detail,
      big: moment.big,
      quiet: false,
      source: "stripe-catchup",
      source_id: moment.source_id,
      occurred_at: moment.occurred_at
    });
    if (inserted) added += 1;
  }
  return { checked, added };
}

/** How far back the hourly job looks: a few days, which is cheap and catches any missed event. */
export const HOURLY_WINDOW_MS = 3 * DAY;
