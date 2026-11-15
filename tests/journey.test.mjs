import { test } from "node:test";
import assert from "node:assert/strict";
import { sendStep } from "../api/_lib/journey.js";

/** A stand-in for the one read a step makes of the database: the order's items. */
const db = (items = []) => ({
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: { detail: { items } } }) })
    })
  })
});

const sarah = { userId: "u1", firstName: "Sarah", fullName: "Sarah Jones", email: "sarah@example.com", phone: "+13035550100", smsOptIn: true, status: "trialing" };
const settings = { journey_enabled: true, texting_enabled: true, discord_wins_enabled: true, sender: "Leah" };
const base = "https://www.practiceinnerboard.com";
const row = (over = {}) => ({ id: "row-1", user_id: "u1", first_name: "Sarah", step: "welcome", channel: "email", ref: "", ...over });

test("the welcome email goes to the member's address, from Leah, once per row", async () => {
  const sent = [];
  const deps = { member: async () => sarah, email: async (mail) => (sent.push(mail), { sent: true, skipped: false, error: "" }) };
  const outcome = await sendStep(db(), row(), { settings, base, deps });
  assert.deepEqual(outcome, { status: "sent", note: "" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "sarah@example.com");
  assert.equal(sent[0].subject, "Welcome to The Practice");
  assert.equal(sent[0].fromName, "Leah from The Practice");
  assert.equal(sent[0].once, "row-1");
  assert.match(sent[0].text, /Hi Sarah,/);
  assert.match(sent[0].html, /practiceinnerboard\.com\/today/);
});

test("a text needs the switch on and the member's own opt-in; without either, nothing goes", async () => {
  let texts = 0;
  const sms = async () => (texts += 1, { sent: true, skipped: false, error: "" });
  const off = await sendStep(db(), row({ channel: "sms" }), { settings: { ...settings, texting_enabled: false }, base, deps: { member: async () => sarah, sms } });
  assert.deepEqual(off, { status: "skipped", note: "texting_off" });
  const noOptIn = await sendStep(db(), row({ channel: "sms" }), { settings, base, deps: { member: async () => ({ ...sarah, smsOptIn: false }), sms } });
  assert.deepEqual(noOptIn, { status: "skipped", note: "no_opt_in" });
  assert.equal(texts, 0);
  const yes = await sendStep(db(), row({ channel: "sms" }), { settings, base, deps: { member: async () => sarah, sms } });
  assert.equal(yes.status, "sent");
  assert.equal(texts, 1);
});

test("a step without Leah's copy is skipped and says why; the whole journey can be switched off", async () => {
  let mails = 0;
  const email = async () => (mails += 1, { sent: true, skipped: false, error: "" });
  const waiting = await sendStep(db(), row({ step: "day6_trial" }), { settings, base, deps: { member: async () => sarah, email } });
  assert.deepEqual(waiting, { status: "skipped", note: "waiting_on_copy" });
  const off = await sendStep(db(), row(), { settings: { ...settings, journey_enabled: false }, base, deps: { member: async () => sarah, email } });
  assert.deepEqual(off, { status: "skipped", note: "journey_off" });
  assert.equal(mails, 0);
});

test("a later step to somebody who gave the trial up, or has no account, is nothing", async () => {
  let mails = 0;
  const email = async () => (mails += 1, { sent: true, skipped: false, error: "" });
  const gone = await sendStep(db(), row({ step: "day2_merch" }), { settings, base, deps: { member: async () => ({ ...sarah, status: "canceled" }), email } });
  assert.deepEqual(gone, { status: "skipped", note: "no_longer_member" });
  const nobody = await sendStep(db(), row(), { settings, base, deps: { member: async () => null, email } });
  assert.deepEqual(nobody, { status: "skipped", note: "no_account" });
  // The welcome itself still goes to somebody whose status is not yet written.
  const fresh = await sendStep(db(), row(), { settings, base, deps: { member: async () => ({ ...sarah, status: "none" }), email } });
  assert.equal(fresh.status, "sent");
  assert.equal(mails, 1);
});

test("the merch thank you names what was ordered, from the order's own card", async () => {
  const sent = [];
  const email = async (mail) => (sent.push(mail), { sent: true, skipped: false, error: "" });
  const outcome = await sendStep(db([{ name: "The Club Hoodie (Cream) / M", quantity: 1 }, { name: "Cap", quantity: 2 }]), row({ step: "merch_order", ref: "cs_1" }), {
    settings,
    base,
    deps: { member: async () => sarah, email }
  });
  assert.equal(outcome.status, "sent");
  assert.match(sent[0].text, /On its way: The Club Hoodie \(Cream\) \/ M, Cap × 2\./);
});

test("a provider that fails is a failed row, kept for the next look, not a crash", async () => {
  const email = async () => ({ sent: false, skipped: false, error: "resend_500" });
  const outcome = await sendStep(db(), row(), { settings, base, deps: { member: async () => sarah, email } });
  assert.deepEqual(outcome, { status: "failed", note: "resend_500" });
  const noAddress = await sendStep(db(), row(), { settings, base, deps: { member: async () => ({ ...sarah, email: "" }), email } });
  assert.deepEqual(noAddress, { status: "skipped", note: "no_address" });
});

test("the Day 1 push goes through the member's devices, and says so", async () => {
  const push = async (_db, userId, payload) => {
    assert.equal(userId, "u1");
    assert.match(payload.body, /Rep of the Day|Practice Coach/);
    return { sent: true, skipped: false, error: "", devices: 2 };
  };
  const outcome = await sendStep(db(), row({ step: "day1_rep", channel: "push" }), { settings, base, deps: { member: async () => sarah, push } });
  assert.deepEqual(outcome, { status: "sent", note: "2 devices" });
});
