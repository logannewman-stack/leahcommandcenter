import { memberById } from "./members.js";
import { emailBody, sendEmail, sendSms } from "./notify.js";
import { sendPush } from "./push.js";
import { EMAIL_FOOTER, messageFor, planFor, stepById, stepIsOn } from "./words.js";

/**
 * The Welcome Journey: planned the moment somebody joins (or upgrades, or
 * orders), sent by the hourly job as each step comes due.
 *
 * Planning writes rows; sending reads the ones that are due, decides for
 * each whether it still should go, sends, and stamps the row. A row is
 * stamped whatever happened, with why, so the Journey page can say so and so
 * the next run never sends it again.
 */

/** Memberships a later step must not write to: the trial was given up. */
const GONE = new Set(["canceled", "incomplete_expired", "unpaid"]);

/**
 * Plans the steps one event calls for. Steps already planned (the same
 * member, step, channel and ref) are left as they are.
 *
 * @param {any} db
 * @param {{ userId: string, firstName: string, on: "join"|"upgrade"|"merch"|"quiet", at?: Date, ref?: string }} input
 * @returns {Promise<number>} how many rows were planned
 */
export async function planJourney(db, { userId, firstName, on, at = new Date(), ref = "" }) {
  const rows = planFor(on, at).map((step) => ({ user_id: userId, first_name: firstName || "", ref, ...step }));
  if (!rows.length) return 0;
  const { error } = await db.from("cc_journey").upsert(rows, { onConflict: "user_id,step,channel,ref", ignoreDuplicates: true });
  if (error) throw new Error(`cc_journey: ${error.message}`);
  return rows.length;
}

/** The items a merch thank-you names: the order's card holds them. */
async function itemsFor(db, ref) {
  if (!ref) return [];
  const { data } = await db.from("cc_pulse_events").select("detail").eq("source_id", `${ref}:merch`).maybeSingle();
  const items = Array.isArray(data?.detail?.items) ? data.detail.items : [];
  return items.map((item) => `${String(item?.name || "").trim()}${Number(item?.quantity) > 1 ? ` × ${Number(item.quantity)}` : ""}`).filter(Boolean);
}

/**
 * Sends one planned step, and says what happened.
 *
 * @param {any} db
 * @param {any} row  a cc_journey row
 * @param {{ settings: any, base: string, deps?: { email?: typeof sendEmail, sms?: typeof sendSms, push?: typeof sendPush, member?: typeof memberById } }} context
 * @returns {Promise<{ status: "sent"|"skipped"|"failed", note: string }>}
 */
export async function sendStep(db, row, { settings, base, deps = {} }) {
  const email = deps.email || sendEmail;
  const sms = deps.sms || sendSms;
  const push = deps.push || sendPush;
  const lookup = deps.member || memberById;

  const step = stepById(row.step);
  if (!step) return { status: "skipped", note: "unknown_step" };
  if (!settings.journey_enabled) return { status: "skipped", note: "journey_off" };
  if (!stepIsOn(step, settings)) return { status: "skipped", note: step.draft ? "waiting_on_leah" : "waiting_on_copy" };

  const member = await lookup(db, row.user_id);
  if (!member) return { status: "skipped", note: "no_account" };
  // A later step of the series, to somebody who gave the trial up: nothing.
  if (step.on === "join" && step.after > 0 && GONE.has(member.status)) return { status: "skipped", note: "no_longer_member" };
  // "Your trial ends tomorrow", to somebody already paying: nothing.
  if (step.id === "day6_trial" && member.status === "active") return { status: "skipped", note: "already_a_member" };

  const items = step.id === "merch_order" ? await itemsFor(db, row.ref) : [];
  const message = messageFor(step.id, { first: member.firstName || row.first_name, base, sender: settings.sender, items });
  if (!message) return { status: "skipped", note: "no_message" };
  const fromName = settings.sender === "The Practice" ? "The Practice" : "Leah from The Practice";

  if (row.channel === "email") {
    if (!member.email) return { status: "skipped", note: "no_address" };
    const { text, html } = emailBody({ title: message.title, paragraphs: message.paragraphs, url: message.url, button: message.button, signoff: message.signoff, footer: EMAIL_FOOTER });
    const result = await email({ to: member.email, subject: message.subject, text, html, fromName, once: row.id });
    return result.sent ? { status: "sent", note: "" } : { status: result.skipped ? "skipped" : "failed", note: result.error };
  }
  if (row.channel === "sms") {
    if (!settings.texting_enabled) return { status: "skipped", note: "texting_off" };
    if (!member.smsOptIn || !member.phone) return { status: "skipped", note: "no_opt_in" };
    if (!message.sms) return { status: "skipped", note: "no_text_copy" };
    const result = await sms({ to: member.phone, body: message.sms });
    return result.sent ? { status: "sent", note: "" } : { status: result.skipped ? "skipped" : "failed", note: result.error };
  }
  if (row.channel === "push") {
    if (!message.push) return { status: "skipped", note: "no_push_copy" };
    const result = await push(db, member.userId, message.push);
    return result.sent ? { status: "sent", note: `${result.devices || 1} device${result.devices === 1 ? "" : "s"}` } : { status: result.skipped ? "skipped" : "failed", note: result.error };
  }
  return { status: "skipped", note: "unknown_channel" };
}

/**
 * Every step that is due, sent, a few at a time, inside the time there is.
 *
 * @param {any} db
 * @param {{ settings: any, base: string, now?: Date, limit?: number, deadlineMs?: number, deps?: any }} context
 */
export async function sendDue(db, { settings, base, now = new Date(), limit = 100, deadlineMs = 40_000, deps }) {
  const started = Date.now();
  const totals = { sent: 0, skipped: 0, failed: 0 };
  const { data: due, error } = await db.from("cc_journey").select("*").eq("status", "due").lte("due_at", now.toISOString()).order("due_at", { ascending: true }).limit(limit);
  if (error) throw new Error(`cc_journey: ${error.message}`);
  for (const row of due || []) {
    if (Date.now() - started > deadlineMs) break;
    let outcome;
    try {
      outcome = await sendStep(db, row, { settings, base, deps });
    } catch (caught) {
      outcome = { status: "failed", note: String(caught?.message || "error").slice(0, 200) };
    }
    totals[outcome.status] += 1;
    await db
      .from("cc_journey")
      .update({ status: outcome.status, note: outcome.note || null, sent_at: outcome.status === "sent" ? new Date().toISOString() : null })
      .eq("id", row.id);
  }
  return totals;
}
