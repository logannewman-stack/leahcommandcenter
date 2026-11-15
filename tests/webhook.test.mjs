import { test } from "node:test";
import assert from "node:assert/strict";
import { receive } from "../api/stripe.js";
import { signFor } from "../api/_lib/stripe.js";

/** A fake response, as Vercel's: status and json, kept for the assertion. */
const reply = () => {
  const out = { status: 0, body: null, headers: {} };
  return {
    out,
    res: {
      setHeader: (k, v) => (out.headers[k] = v),
      status(code) {
        out.status = code;
        return this;
      },
      json(body) {
        out.body = body;
        return this;
      }
    }
  };
};

/** A fake database: the one insert the webhook makes, with the unique key honoured. */
const database = () => {
  const rows = [];
  const counts = () => ({ count: rows.length });
  const db = {
    rows,
    from: (table) => ({
      insert: (row) => ({
        select: () => ({
          single: async () => {
            if (rows.some((r) => r.source_id === row.source_id)) return { data: null, error: { code: "23505", message: "duplicate" } };
            const saved = { id: `id-${rows.length + 1}`, ...row };
            rows.push(saved);
            return { data: saved, error: null };
          }
        })
      }),
      select: (_cols, options) => {
        const chain = {
          eq: () => chain,
          gte: () => chain,
          maybeSingle: async () => ({ data: rows.find(Boolean) || null }),
          then: (resolve) => resolve(options?.head ? counts() : { data: rows })
        };
        return table === "cc_pulse_events" ? chain : chain;
      }
    })
  };
  return db;
};

const SECRET = "whsec_t";
const event = {
  id: "evt_1",
  type: "customer.subscription.created",
  created: 1_800_000_000,
  data: { object: { id: "sub_1", customer: "cus_1", status: "trialing", trial_end: 1_800_604_800, metadata: { user_id: "11111111-1111-1111-1111-111111111111", plan: "month" } } }
};

const request = (body, headers = {}) => ({ method: "POST", headers: { "stripe-signature": signFor(body, SECRET), ...headers }, body });

test("a signed join is one card, one Discord line and one welcome series; the same event again is nothing more", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  const db = database();
  const posted = [];
  const planned = [];
  const deps = {
    forCustomer: async (_db, customer, hint) => (customer === "cus_1" && hint ? { userId: hint, firstName: "Sarah" } : null),
    discord: async (line) => (posted.push(line), { sent: true }),
    plan: async (_db, input) => (planned.push(input), 7),
    settings: async () => ({ journey_enabled: true, texting_enabled: false, discord_wins_enabled: true, sender: "Leah" })
  };
  const body = JSON.stringify(event);
  const first = reply();
  await receive(request(body), first.res, db, deps);
  assert.equal(first.out.status, 200);
  assert.equal(first.out.body.inserted, true);
  assert.equal(first.out.body.kind, "join");
  assert.equal(first.out.body.discord, "sent");
  assert.equal(first.out.body.planned, 7);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].first_name, "Sarah");
  assert.equal(db.rows[0].user_id, "11111111-1111-1111-1111-111111111111");
  assert.equal(JSON.stringify(db.rows[0]).includes("@"), false, "no address on the card");
  assert.match(posted[0], /^🎉 Welcome, Sarah! 1 new member today\.$/);
  assert.equal(planned[0].on, "join");

  const again = reply();
  await receive(request(body), again.res, db, deps);
  assert.equal(again.out.status, 200);
  assert.equal(again.out.body.inserted, false);
  assert.equal(posted.length, 1);
  assert.equal(planned.length, 1);
});

test("a bad signature is refused before anything is read", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  const db = database();
  const { res, out } = reply();
  await receive({ method: "POST", headers: { "stripe-signature": "t=1,v1=00" }, body: JSON.stringify(event) }, res, db, {});
  assert.equal(out.status, 400);
  assert.equal(db.rows.length, 0);
});

test("an event that is not a moment is acknowledged and ignored; a GET is not allowed", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  const db = database();
  const { res, out } = reply();
  await receive(request(JSON.stringify({ ...event, type: "invoice.paid" })), res, db, {});
  assert.equal(out.status, 200);
  assert.equal(out.body.ignored, true);
  const got = reply();
  await receive({ method: "GET", headers: {} }, got.res, db, {});
  assert.equal(got.out.status, 405);
});

test("without the signing secret, the event is read back from Stripe by its id", async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const db = database();
  const { res, out } = reply();
  const deps = {
    fetchEvent: async (id) => (id === "evt_1" ? event : null),
    forCustomer: async () => ({ userId: "11111111-1111-1111-1111-111111111111", firstName: "Sarah" }),
    discord: async () => ({ sent: true }),
    plan: async () => 7,
    settings: async () => ({ journey_enabled: true, discord_wins_enabled: false, sender: "Leah" })
  };
  await receive({ method: "POST", headers: {}, body: { id: "evt_1" } }, res, db, deps);
  assert.equal(out.status, 200);
  assert.equal(out.body.inserted, true);
  assert.equal(out.body.discord, undefined, "Discord is off in the settings");
});

test("a merch order from a guest at the shop is a card with its items and no welcome", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  const db = database();
  const planned = [];
  const session = {
    id: "evt_2",
    type: "checkout.session.completed",
    created: 1_800_000_100,
    data: {
      object: {
        id: "cs_1",
        payment_status: "paid",
        amount_total: 6800,
        currency: "usd",
        customer_details: { email: "guest@example.com", name: "Pat Lee", address: { city: "Boise" } },
        metadata: { kind: "shop", order: "9:1" }
      }
    }
  };
  const deps = {
    byEmail: async () => null,
    lineItems: async () => [{ name: "The Club Hoodie (Cream) / M", quantity: 1, amount_cents: 6800 }],
    discord: async () => ({ sent: true }),
    plan: async (_db, input) => (planned.push(input), 1),
    settings: async () => ({ journey_enabled: true, discord_wins_enabled: true, sender: "Leah" })
  };
  const { res, out } = reply();
  await receive(request(JSON.stringify(session)), res, db, deps);
  assert.equal(out.status, 200);
  assert.equal(out.body.kind, "merch");
  assert.equal(db.rows[0].first_name, "Pat");
  assert.equal(db.rows[0].city, "Boise");
  assert.deepEqual(db.rows[0].detail.items, [{ name: "The Club Hoodie (Cream) / M", quantity: 1 }]);
  assert.equal(db.rows[0].user_id, null);
  assert.equal(planned.length, 0, "nobody to write to: the Practice app's own order email covers a guest");
});
