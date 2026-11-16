import { admin, practiceUrl, readRawBody, settingsOf } from "./_lib/guard.js";
import { lineItemsOf, stripe, stripeConfig, verifySignature } from "./_lib/stripe.js";
import { WEBHOOK_EVENTS, countsFor, pulseFrom, recordPulse } from "./_lib/pulse.js";
import { memberByEmail, memberForCustomer } from "./_lib/members.js";
import { postWins } from "./_lib/discord.js";
import { planJourney, sendDue } from "./_lib/journey.js";
import { POSTS_TO_DISCORD, discordLine, firstNameOf } from "./_lib/words.js";

/**
 * Stripe, telling the Command Center a member did something.
 *
 * This is a SECOND webhook endpoint on the Practice's Stripe account, made
 * by hand (Developers → Webhooks → Add endpoint) at `<this app>/api/stripe`
 * with the events in `WEBHOOK_EVENTS`, and its signing secret in Vercel as
 * `STRIPE_WEBHOOK_SECRET`. The Practice app's own endpoint keeps doing its
 * job; Stripe sends every event to both.
 *
 * ── How an event is trusted ─────────────────────────────────────────────
 * With the body as it was sent and the secret set, the signature is checked
 * and a body that fails it is refused. Without either, the event is read
 * back from Stripe by its id with the secret key, which only Stripe can
 * answer for this account.
 *
 * ── What happens ────────────────────────────────────────────────────────
 * The event becomes a card (`pulseFrom`), the card is written once
 * (`recordPulse`, by its source id), and only a card written for the first
 * time goes on: a line in #wins and the Welcome Journey's steps. So an event
 * Stripe delivers twice, or tells twice (created and then updated), is one
 * card, one post, one welcome.
 *
 * Every answer but a refused signature is a 200 once the work is done, and
 * a 500 when it could not be, so Stripe tries again.
 */

export const config = { api: { bodyParser: false }, maxDuration: 20 };

const RELEVANT = new Set(WEBHOOK_EVENTS);

export default function handler(req, res) {
  return receive(req, res, admin);
}

/**
 * The webhook with everything it reaches handed in, so the suite can run it.
 *
 * @param {any} req
 * @param {any} res
 * @param {any} db  the service-key client, or null
 * @param {{ forCustomer?: typeof memberForCustomer, byEmail?: typeof memberByEmail, lineItems?: typeof lineItemsOf, discord?: typeof postWins, plan?: typeof planJourney, send?: typeof sendDue, settings?: typeof settingsOf, fetchEvent?: (id: string) => Promise<any> }} [deps]
 */
export async function receive(req, res, db, deps = {}) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!db) return res.status(503).json({ error: "not_open" });

  const { raw, parsed } = await readRawBody(req);
  const { webhookSecret, secret } = stripeConfig();
  const header = req.headers?.["stripe-signature"];

  let event = null;
  if (raw && webhookSecret) {
    if (!verifySignature(raw, Array.isArray(header) ? header[0] : header, webhookSecret)) return res.status(400).json({ error: "bad_signature" });
    event = parsed;
  } else if (secret || deps.fetchEvent) {
    const id = typeof parsed?.id === "string" && /^evt_[A-Za-z0-9]+$/.test(parsed.id) ? parsed.id : "";
    if (!id) return res.status(400).json({ error: "bad_request" });
    try {
      event = await (deps.fetchEvent || ((eventId) => stripe("GET", `/events/${eventId}`)))(id);
    } catch (error) {
      return error?.status === 404 ? res.status(400).json({ error: "unknown_event" }) : res.status(500).json({ error: "upstream" });
    }
  } else {
    return res.status(503).json({ error: "not_open" });
  }

  if (!event || !RELEVANT.has(event.type)) return res.status(200).json({ received: true, ignored: true });
  const moment = pulseFrom(event);
  if (!moment) return res.status(200).json({ received: true, ignored: true });

  try {
    let member = null;
    if (moment.customer || moment.hint) member = await (deps.forCustomer || memberForCustomer)(db, moment.customer, moment.hint);
    if (!member && moment.email) member = await (deps.byEmail || memberByEmail)(db, moment.email);
    const first_name = member?.firstName || firstNameOf(moment.nameHint);

    const detail = { ...moment.detail };
    if (moment.session && (moment.kind === "merch" || moment.kind === "gift")) {
      try {
        const items = await (deps.lineItems || lineItemsOf)(moment.session);
        if (moment.kind === "merch") detail.items = items.map(({ name, quantity }) => ({ name, quantity }));
        else if (!detail.item) detail.item = items.map((item) => item.name).filter(Boolean).join(", ");
      } catch (error) {
        console.warn("stripe webhook, line items:", error?.status, error?.message);
      }
    }

    const { inserted, row } = await recordPulse(db, {
      kind: moment.kind,
      user_id: member?.userId || null,
      first_name,
      city: moment.city,
      detail,
      big: moment.big,
      quiet: moment.quiet,
      source: "stripe",
      source_id: moment.source_id,
      occurred_at: moment.occurred_at
    });
    const said = { received: true, kind: moment.kind, inserted };
    if (!inserted) return res.status(200).json(said);

    const settings = await (deps.settings || settingsOf)(db);
    if (settings.discord_wins_enabled && POSTS_TO_DISCORD.has(moment.kind) && !moment.quiet) {
      const counts = await countsFor(db, moment.kind).catch(() => ({}));
      const posted = await (deps.discord || postWins)(discordLine(row, counts));
      said.discord = posted.sent ? "sent" : posted.error;
    }
    if (member && ["join", "upgrade", "merch"].includes(moment.kind)) {
      said.planned = await (deps.plan || planJourney)(db, {
        userId: member.userId,
        firstName: member.firstName,
        on: moment.kind,
        at: new Date(moment.occurred_at),
        ref: moment.kind === "merch" ? moment.session : "",
        trialEnd: moment.kind === "join" ? moment.detail.trial_end || null : null
      });
      // The welcome and "You're officially in" go now, not at the next hourly run.
      if (moment.kind !== "merch") {
        try {
          said.sent = await (deps.send || sendDue)(db, { settings, base: practiceUrl(), userId: member.userId, deadlineMs: 8000 });
        } catch (error) {
          console.warn("stripe webhook, send now:", error?.message);
        }
      }
    }
    return res.status(200).json(said);
  } catch (error) {
    console.error("stripe webhook:", error?.status, error?.message);
    return res.status(500).json({ error: "upstream" });
  }
}

export { practiceUrl };
