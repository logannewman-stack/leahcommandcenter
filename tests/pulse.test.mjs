import { test } from "node:test";
import assert from "node:assert/strict";
import { pulseFrom, WEBHOOK_EVENTS } from "../api/_lib/pulse.js";

const event = (type, object, previous_attributes) => ({ id: "evt_1", type, created: 1_800_000_000, data: { object, ...(previous_attributes ? { previous_attributes } : {}) } });
const sub = (over = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "trialing",
  trial_end: 1_800_604_800,
  current_period_end: 1_800_604_800,
  cancel_at_period_end: false,
  metadata: { user_id: "11111111-1111-1111-1111-111111111111", plan: "month" },
  items: { data: [{ price: { recurring: { interval: "month" } } }] },
  ...over
});

test("a new trial is a join; a full membership straight away is a join without a trial", () => {
  const trial = pulseFrom(event("customer.subscription.created", sub()));
  assert.equal(trial.kind, "join");
  assert.equal(trial.source_id, "sub_1:join");
  assert.equal(trial.detail.trial, true);
  assert.equal(trial.detail.plan, "month");
  assert.equal(trial.customer, "cus_1");
  assert.equal(trial.hint, "11111111-1111-1111-1111-111111111111");
  assert.equal(trial.quiet, false);

  const paid = pulseFrom(event("customer.subscription.created", sub({ status: "active" })));
  assert.equal(paid.kind, "join");
  assert.equal(paid.detail.trial, false);

  assert.equal(pulseFrom(event("customer.subscription.created", sub({ status: "incomplete" }))), null, "not paid yet: nothing");
  assert.equal(pulseFrom(event("customer.subscription.created", sub({ metadata: { kind: "team" } }))), null, "a team plan is not a membership");
});

test("a trial that became active is an upgrade, and a bigger moment", () => {
  const moment = pulseFrom(event("customer.subscription.updated", sub({ status: "active" }), { status: "trialing" }));
  assert.equal(moment.kind, "upgrade");
  assert.equal(moment.source_id, "sub_1:upgrade");
  assert.equal(moment.big, true);
  // A renewal, or any other update, is nothing.
  assert.equal(pulseFrom(event("customer.subscription.updated", sub({ status: "active" }), { current_period_end: 1 })), null);
});

test("an incomplete subscription that is paid now is a join, under the same id as a created one", () => {
  const moment = pulseFrom(event("customer.subscription.updated", sub({ status: "active" }), { status: "incomplete" }));
  assert.equal(moment.kind, "join");
  assert.equal(moment.source_id, "sub_1:join");
});

test("a cancel is quiet, once per subscription, whether set to end or ended", () => {
  const scheduled = pulseFrom(event("customer.subscription.updated", sub({ status: "active", cancel_at_period_end: true }), { cancel_at_period_end: false }));
  assert.equal(scheduled.kind, "cancel");
  assert.equal(scheduled.quiet, true);
  assert.equal(scheduled.detail.at_period_end, true);
  assert.equal(scheduled.source_id, "sub_1:cancel");

  const ended = pulseFrom(event("customer.subscription.updated", sub({ status: "canceled" }), { status: "active" }));
  assert.equal(ended.kind, "cancel");
  assert.equal(ended.detail.at_period_end, false);
  assert.equal(ended.source_id, "sub_1:cancel");

  const deleted = pulseFrom(event("customer.subscription.deleted", sub({ status: "canceled" })));
  assert.equal(deleted.kind, "cancel");
  assert.equal(deleted.source_id, "sub_1:cancel");

  // Taking a cancel back is not a card.
  assert.equal(pulseFrom(event("customer.subscription.updated", sub({ status: "active", cancel_at_period_end: false }), { cancel_at_period_end: true })), null);
});

test("a paid shop checkout is merch, with the city off the order and never the email on the card", () => {
  const session = {
    id: "cs_1",
    customer: null,
    payment_status: "paid",
    amount_total: 7200,
    currency: "usd",
    customer_details: { email: "sarah@example.com", name: "Sarah Jones", address: { city: "Denver" } },
    metadata: { kind: "shop", order: "123:1", to_name: "Sarah Jones", to_city: "Denver", to_email: "sarah@example.com" }
  };
  const moment = pulseFrom(event("checkout.session.completed", session));
  assert.equal(moment.kind, "merch");
  assert.equal(moment.source_id, "cs_1:merch");
  assert.equal(moment.city, "Denver");
  assert.equal(moment.email, "sarah@example.com", "kept aside for the lookup, not on the detail");
  assert.equal(moment.nameHint, "Sarah Jones");
  assert.deepEqual(moment.detail, { amount_cents: 7200, currency: "usd", items: [] });
  assert.equal(moment.session, "cs_1");
  assert.equal(JSON.stringify(moment.detail).includes("@"), false);

  assert.equal(pulseFrom(event("checkout.session.completed", { ...session, payment_status: "unpaid" })), null);
  assert.equal(pulseFrom(event("checkout.session.completed", { ...session, metadata: { kind: "course" } })), null);
  assert.equal(pulseFrom(event("checkout.session.completed", { ...session, metadata: { kind: "inq" } })), null);
});

test("a paid checkout marked gift is a gift, and a bigger moment", () => {
  const session = { id: "cs_g", payment_status: "paid", amount_total: 32900, currency: "usd", customer_details: { email: "a@b.co", name: "Amy" }, metadata: { kind: "gift", item: "Hat plus one year" } };
  const moment = pulseFrom(event("checkout.session.completed", session));
  assert.equal(moment.kind, "gift");
  assert.equal(moment.big, true);
  assert.equal(moment.detail.item, "Hat plus one year");
  assert.equal(moment.source_id, "cs_g:gift");
});

test("the events asked of Stripe are the four the mapping reads", () => {
  assert.deepEqual(WEBHOOK_EVENTS, ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
  assert.equal(pulseFrom(event("invoice.paid", {})), null);
  assert.equal(pulseFrom(null), null);
});
