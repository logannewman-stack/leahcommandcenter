import { test } from "node:test";
import assert from "node:assert/strict";
import { stepById, SCOLDS, BANNED_WORDS, STEPS, discordLine, feedLine, firstNameOf, messageFor, planFor, POSTS_TO_DISCORD, whoOf } from "../api/_lib/words.js";
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

test("a join plans the guide's series: Day 0, 1, 3, 5 and the day before the trial ends", () => {
  const at = new Date("2026-12-01T15:00:00Z");
  const series = planFor("join", at);
  const days = (step, list = series) => list.filter((row) => row.step === step).map((row) => (new Date(row.due_at) - at) / 86400000);
  assert.deepEqual(days("welcome"), [0, 0], "email and text, right away");
  assert.deepEqual(days("day1_rep"), [1]);
  assert.deepEqual(days("day1_story"), [1]);
  assert.deepEqual(days("day3_lab"), [3]);
  assert.deepEqual(days("day5_merch"), [5]);
  assert.deepEqual(days("day6_trial"), [6, 6], "without Stripe's trial end, day 6");
  // With Stripe's trial end: exactly 24 hours before it.
  const timed = planFor("join", at, { trialEnd: "2026-12-08T09:30:00Z" });
  assert.equal(timed.find((row) => row.step === "day6_trial").due_at, "2026-12-07T09:30:00.000Z");
  assert.equal(series.some((row) => row.step === "upgrade"), false);
  assert.deepEqual(planFor("upgrade", at).map((row) => row.step), ["upgrade"]);
  assert.deepEqual(planFor("merch", at).map((row) => row.step), ["merch_order"]);
  assert.deepEqual(planFor("quiet", at).map((row) => row.step), ["quiet_7"]);
  assert.deepEqual(planFor("nothing", at), []);
});

test("a step planned under its old name still sends, as the step it became", () => {
  assert.equal(stepById("day2_merch").id, "day5_merch");
  assert.equal(stepById("day4_lab").id, "day3_lab");
  assert.equal(stepById("quiet_10").id, "quiet_7");
  assert.equal(messageFor("day4_lab", { first: "Sarah", base: "https://x.y" }).url, "https://x.y/lab");
});

test("every step has a message, and every one is Leah's own copy, so every one sends", () => {
  const on = STEPS.filter((step) => step.enabled).map((step) => step.id);
  assert.deepEqual(on, ["welcome", "day1_rep", "day1_story", "day3_lab", "day5_merch", "day6_trial", "upgrade", "merch_order", "quiet_7"]);
  for (const step of STEPS) {
    const message = messageFor(step.id, { first: "Sarah", base: "https://www.practiceinnerboard.com/" });
    assert.ok(message, step.id);
    assert.ok(message.subject && message.title && message.button && message.url.startsWith("https://www.practiceinnerboard.com/"), step.id);
    if (step.channels.includes("sms")) assert.ok(message.sms, `${step.id} has a text`);
    if (step.channels.includes("push")) assert.ok(message.push, `${step.id} has a push`);
    if (!step.enabled && !step.draft) assert.match([message.title, ...message.paragraphs].join(" "), /\[/, `${step.id} is marked as a placeholder`);
    if (step.draft) assert.doesNotMatch([message.title, ...message.paragraphs, message.sms || ""].join(" "), /\[/, `${step.id} is a full draft`);
  }
  assert.equal(messageFor("nope", { first: "x", base: "" }), null);
});

test("Leah's words, as the Email Automation Guide has them, and the sender she chose", () => {
  const base = "https://www.practiceinnerboard.com";
  const welcome = messageFor("welcome", { first: "Sarah", base });
  assert.equal(welcome.subject, "Welcome to The Practice. Your life deserves this. 🤍");
  assert.equal(welcome.title, "Hey Sarah!");
  assert.equal(welcome.paragraphs[3], "You're already successful.");
  assert.equal(welcome.paragraphs.at(-1), "You get one life. Let's get good at living it.");
  assert.equal(welcome.button, "Open The Practice");
  assert.equal(welcome.url, `${base}/today`);
  assert.equal(welcome.signoff, "With love,\nLeah 🤍\nFounder, The Practice by InnerBoard");
  assert.match(welcome.sms, /^Hi Sarah, it's Leah!/);
  assert.match(welcome.sms, /Reply STOP to opt out\.$/);
  assert.equal(messageFor("welcome", { first: "", base }).title, "Hey there!", "a friendly fallback with no name");

  const subjects = Object.fromEntries(["day1_story", "day3_lab", "day5_merch", "day6_trial", "upgrade", "quiet_7"].map((id) => [id, messageFor(id, { first: "Sarah", base }).subject]));
  assert.deepEqual(subjects, {
    day1_story: "Can I tell you why I created The Practice?",
    day3_lab: "Have you discovered the Lab yet? You’re going to love this. 🤍",
    day5_merch: "It’s more than merch. It’s a movement. 🤍",
    day6_trial: "Your life is worth showing up for. 🤍",
    upgrade: "You chose your life. Let’s celebrate that! 🤍",
    quiet_7: "A little reminder. You matter, too. 🤍"
  });
  const links = Object.fromEntries(["day1_story", "day3_lab", "day5_merch", "day6_trial", "upgrade", "quiet_7"].map((id) => [id, messageFor(id, { first: "Sarah", base }).url.slice(base.length)]));
  assert.deepEqual(links, { day1_story: "/coach", day3_lab: "/lab", day5_merch: "/club", day6_trial: "/profile", upgrade: "/today", quiet_7: "/today" });
  assert.equal(messageFor("upgrade", { first: "Sarah", base }).paragraphs[0], "YOU'RE OFFICIALLY IN! 🎉🤍");

  const practice = messageFor("upgrade", { first: "Sarah", base: "https://x.y", sender: "The Practice" });
  assert.equal(practice.signoff, "With love,\nThe Practice by InnerBoard");

  const order = messageFor("merch_order", { first: "Sarah", base: "https://x.y", items: ["Cap", "Tote"] });
  assert.equal(order.title, "Thank you for your order, Sarah!");
  assert.match(order.paragraphs[0], /Cap, Tote/);
  assert.match(order.paragraphs[1], /wear it proud and tag us/);
});

test("nothing a member reads carries a banned word or a scold", () => {
  for (const step of STEPS.filter((s) => s.enabled || s.draft)) {
    const message = messageFor(step.id, { first: "Sarah", base: "https://x.y", items: ["Cap"] });
    const all = [message.subject, message.title, ...message.paragraphs, message.signoff, message.sms || "", message.push?.body || ""].join(" ").toLowerCase();
    for (const word of BANNED_WORDS) assert.equal(all.includes(word), false, `${step.id} says "${word}"`);
    for (const scold of SCOLDS) assert.doesNotMatch(all, scold, `${step.id} scolds`);
  }
  // Leah's invitation is not a scold; a counted gap would be.
  assert.equal(SCOLDS.some((s) => s.test("because if you haven't, you're in for something pretty special")), false);
  assert.equal(SCOLDS.some((s) => s.test("you haven't practiced in 9 days")), true);
});

test("an email is the title, the paragraphs, one button, the sign-off and the footer, in text and html", () => {
  const { text, html } = emailBody({ title: "Hi Sarah,", paragraphs: ["One.", "Two & three."], url: "https://x.y/today", button: "Open", signoff: "With love,\nLeah", footer: "Manage these in the app." });
  assert.match(text, /^Hi Sarah,\n\nOne\.\n\nTwo & three\.\n\nOpen: https:\/\/x\.y\/today\n\nWith love,\nLeah\n\nManage these in the app\.$/);
  assert.match(html, /Two &amp; three\./);
  assert.match(html, /href="https:\/\/x\.y\/today"/);
  assert.match(html, /white-space:pre-line">With love,\nLeah</);
});

test("a draft sends only once an admin turns it on", async () => {
  const { stepIsOn, stepById } = await import("../src/lib/words.js");
  assert.equal(stepIsOn(stepById("welcome"), {}), true);
  const draft = { id: "day3_lab", draft: true, enabled: false };
  assert.equal(stepIsOn(draft, {}), false);
  assert.equal(stepIsOn(draft, { journey_approved: ["day6_trial"] }), false);
  assert.equal(stepIsOn(draft, { journey_approved: ["day3_lab"] }), true);
  assert.equal(stepIsOn(draft, { journey_approved: ["day4_lab"] }), true, "an OK given under its old name still counts");
  assert.equal(stepIsOn(null, { journey_approved: ["day6_trial"] }), false);
});
