import { test } from "node:test";
import assert from "node:assert/strict";
import { lineItemsOf, monthlyOf, recurringNow, signFor, verifySignature } from "../api/_lib/stripe.js";

const SECRET = "whsec_test_secret";

test("a signature Stripe wrote is accepted, exactly once per body", () => {
  const raw = JSON.stringify({ id: "evt_1", type: "customer.subscription.created" });
  const header = signFor(raw, SECRET);
  assert.equal(verifySignature(raw, header, SECRET), true);
  assert.equal(verifySignature(Buffer.from(raw), header, SECRET), true);
  assert.equal(verifySignature(`${raw} `, header, SECRET), false, "a changed body fails");
  assert.equal(verifySignature(raw, header, "whsec_other"), false, "another secret fails");
});

test("an old signature is refused, and a malformed header too", () => {
  const raw = "{}";
  const old = signFor(raw, SECRET, Math.floor(Date.now() / 1000) - 600);
  assert.equal(verifySignature(raw, old, SECRET), false);
  assert.equal(verifySignature(raw, "t=abc,v1=zz", SECRET), false);
  assert.equal(verifySignature(raw, "", SECRET), false);
  assert.equal(verifySignature("", signFor("", SECRET), SECRET), false);
});

test("a subscription's monthly worth: by the month, by the year spread, by the seat", () => {
  const monthly = { items: { data: [{ quantity: 1, price: { unit_amount: 2900, recurring: { interval: "month", interval_count: 1 } } }] } };
  const yearly = { items: { data: [{ quantity: 1, price: { unit_amount: 24900, recurring: { interval: "year", interval_count: 1 } } }] } };
  const seats = { items: { data: [{ quantity: 4, price: { unit_amount: 1500, recurring: { interval: "month", interval_count: 1 } } }] } };
  assert.equal(monthlyOf(monthly), 2900);
  assert.equal(monthlyOf(yearly), 2075);
  assert.equal(monthlyOf(seats), 6000);
  assert.equal(monthlyOf(null), 0);
});

test("recurring revenue pages through Stripe and leaves trials out of the money", async () => {
  const pages = {
    active: [{ data: [{ id: "sub_a", items: { data: [{ quantity: 1, price: { unit_amount: 2900, recurring: { interval: "month" } } }] } }], has_more: false }],
    past_due: [{ data: [], has_more: false }],
    trialing: [{ data: [{ id: "sub_t", items: { data: [{ quantity: 1, price: { unit_amount: 2900, recurring: { interval: "month" } } }] } }], has_more: false }]
  };
  const call = async (_method, _path, params) => pages[params.status].shift();
  const totals = await recurringNow({ call });
  assert.deepEqual(totals, { mrr_cents: 2900, active_paying: 1, trialing: 1 });
});

test("line items are named, counted and nothing else; a bad id asks nothing", async () => {
  let asked = "";
  const call = async (_method, path) => {
    asked = path;
    return { data: [{ description: "The Club Hoodie (Cream) / M", quantity: 2, amount_total: 13600 }, { description: "", price: { product: { name: "Cap" } }, quantity: 1, amount_total: 3200 }] };
  };
  const items = await lineItemsOf("cs_test_123", { call });
  assert.equal(asked, "/checkout/sessions/cs_test_123/line_items");
  assert.deepEqual(items, [
    { name: "The Club Hoodie (Cream) / M", quantity: 2, amount_cents: 13600 },
    { name: "Cap", quantity: 1, amount_cents: 3200 }
  ]);
  assert.deepEqual(await lineItemsOf("../evil", { call }), []);
});
