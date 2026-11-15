import { test } from "node:test";
import assert from "node:assert/strict";
import { BANNED_WORDS, STEPS, discordLine, feedLine, firstNameOf, messageFor, planFor, POSTS_TO_DISCORD, whoOf } from "../api/_lib/words.js";
import { emailBody } from "../api/_lib/notify.js";

test("a first name is the first word, as a name is written", () => {
  assert.equal(firstNameOf("Sarah Jones"), "Sarah");
  assert.equal(firstNameOf("  sarah  jones "), "Sarah");
  assert.equal(firstNameOf("SARAH-JANE SMITH"), "Sarah-Jane");
  assert.equal(firstNameOf(""), "");
  assert.equal(firstNameOf(null), "");
});

test("the feed says first name and city, and nothing else about a person", () => {
  assert.equal(whoOf({ first_name: "Sarah", city: "Denver" }), "Sarah from Denver");
  assert.equal(whoOf({ first_name: "Sarah" }), "Sarah");
  assert.equal(whoOf({}), "A new member");
  const join = feedLine({ kind: "join", first_name: "Sarah", city: "Denver", detail: { trial: true } });
  assert.equal(join.title, "Welcome, Sarah from Denver!");
  assert.equal(join.body, "Started the 7 day trial.");
  const merch = feedLine({ kind: "merch", first_name: "Sarah", detail: { amount_cents: 6800, currency: "usd", items: [{ name: "The Club Hoodie (Cream) / M", quantity: 1 }] } });
  assert.equal(merch.title, "Sarah bought merch.");
  assert.match(merch.body, /The Club Hoodie \(Cream\) \/ M · \$68/);
  const cancel = feedLine({ kind: "cancel", first_name: "Sarah", detail: { at_period_end: true } });
  assert.match(cancel.body, /personal note/);
});

test("Discord posts the loud moments with their running counts, and never a quiet one", () => {
  assert.equal(discordLine({ kind: "join", first_name: "Sarah", city: "Denver" }, { today: 3 }), "🎉 Welcome, Sarah from Denver! 3 new members today.");
  assert.equal(discordLine({ kind: "join", first_name: "Sarah" }, { today: 1 }), "🎉 Welcome, Sarah! 1 new member today.");
  assert.equal(discordLine({ kind: "upgrade", first_name: "Sarah" }, { month: 12 }), "✨ Sarah is officially a full member. 12 upgrades this month.");
  assert.equal(discordLine({ kind: "gift", detail: { item: "Hat plus one year" } }, { total: 4 }), "🎁 A holiday gift was purchased: Hat plus one year. 4 gifts so far.");
  assert.match(discordLine({ kind: "merch", first_name: "Sarah", detail: { items: [{ name: "Cap", quantity: 2 }] } }), /ordered Cap × 2/);
  assert.equal(discordLine({ kind: "cancel", first_name: "Sarah" }), "");
  assert.equal(discordLine({ kind: "trial_ending", first_name: "Sarah" }), "");
  assert.equal(POSTS_TO_DISCORD.has("cancel"), false);
  assert.equal(POSTS_TO_DISCORD.has("join"), true);
});

test("a join plans the series on its days; an upgrade and an order plan one message each", () => {
  const at = new Date("2026-12-01T15:00:00Z");
  const series = planFor("join", at);
  const days = (step) => series.filter((row) => row.step === step).map((row) => Math.round((new Date(row.due_at) - at) / 86400000));
  assert.deepEqual(days("welcome"), [0, 0], "email and text, right away");
  assert.deepEqual(days("day1_rep"), [1]);
  assert.deepEqual(days("day2_merch"), [2]);
  assert.deepEqual(days("day4_lab"), [4]);
  assert.deepEqual(days("day6_trial"), [6, 6]);
  assert.equal(series.some((row) => row.step === "upgrade"), false);
  assert.deepEqual(planFor("upgrade", at).map((row) => row.step), ["upgrade"]);
  assert.deepEqual(planFor("merch", at).map((row) => row.step), ["merch_order"]);
  assert.deepEqual(planFor("quiet", at).map((row) => row.step), ["quiet_10"]);
  assert.deepEqual(planFor("nothing", at), []);
});

test("every step has a message; the ones Leah wrote are on, the placeholders are off", () => {
  const on = STEPS.filter((step) => step.enabled).map((step) => step.id);
  assert.deepEqual(on, ["welcome", "day1_rep", "day2_merch", "upgrade", "merch_order"]);
  for (const step of STEPS) {
    const message = messageFor(step.id, { first: "Sarah", base: "https://www.practiceinnerboard.com/" });
    assert.ok(message, step.id);
    assert.ok(message.subject && message.title && message.button && message.url.startsWith("https://www.practiceinnerboard.com/"), step.id);
    if (step.channels.includes("sms")) assert.ok(message.sms, `${step.id} has a text`);
    if (step.channels.includes("push")) assert.ok(message.push, `${step.id} has a push`);
    if (!step.enabled) assert.match([message.title, ...message.paragraphs].join(" "), /\[/, `${step.id} is marked as a placeholder`);
  }
  assert.equal(messageFor("nope", { first: "x", base: "" }), null);
});

test("Leah's words, as the appendix has them, and the sender she chose", () => {
  const welcome = messageFor("welcome", { first: "Sarah", base: "https://www.practiceinnerboard.com" });
  assert.equal(welcome.subject, "Welcome to The Practice");
  assert.equal(welcome.title, "Hi Sarah,");
  assert.match(welcome.paragraphs[1], /borrowed belief/);
  assert.match(welcome.signoff, /With love,\nLeah/);
  assert.match(welcome.sms, /^Hi Sarah, it's Leah!/);
  assert.match(welcome.sms, /Reply STOP to opt out\.$/);

  const practice = messageFor("upgrade", { first: "Sarah", base: "https://x.y", sender: "The Practice" });
  assert.match(practice.signoff, /The Practice$/);
  assert.equal(practice.paragraphs.length, 1, "no referral line until the program exists");
  const withLink = messageFor("upgrade", { first: "Sarah", base: "https://x.y", referralLink: "https://x.y/r/abc" });
  assert.match(withLink.paragraphs[1], /https:\/\/x\.y\/r\/abc/);

  const order = messageFor("merch_order", { first: "Sarah", base: "https://x.y", items: ["Cap", "Tote"] });
  assert.equal(order.title, "Thank you for your order, Sarah!");
  assert.match(order.paragraphs[0], /Cap, Tote/);
  assert.match(order.paragraphs[1], /wear it proud and tag us/);
});

test("nothing a member reads carries a banned word or a scold", () => {
  for (const step of STEPS.filter((s) => s.enabled)) {
    const message = messageFor(step.id, { first: "Sarah", base: "https://x.y", items: ["Cap"] });
    const all = [message.subject, message.title, ...message.paragraphs, message.signoff, message.sms || "", message.push?.body || ""].join(" ").toLowerCase();
    for (const word of BANNED_WORDS) assert.equal(all.includes(word), false, `${step.id} says "${word}"`);
  }
});

test("an email is the title, the paragraphs, one button, the sign-off and the footer, in text and html", () => {
  const { text, html } = emailBody({ title: "Hi Sarah,", paragraphs: ["One.", "Two & three."], url: "https://x.y/today", button: "Open", signoff: "With love,\nLeah", footer: "Manage these in the app." });
  assert.match(text, /^Hi Sarah,\n\nOne\.\n\nTwo & three\.\n\nOpen: https:\/\/x\.y\/today\n\nWith love,\nLeah\n\nManage these in the app\.$/);
  assert.match(html, /Two &amp; three\./);
  assert.match(html, /href="https:\/\/x\.y\/today"/);
  assert.match(html, /white-space:pre-line">With love,\nLeah</);
});
