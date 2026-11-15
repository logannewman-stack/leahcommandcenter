import { admin, cronAuthorized, practiceUrl, settingsOf } from "./_lib/guard.js";
import { memberById, quietMembers, trialsEndingWithin } from "./_lib/members.js";
import { recordPulse } from "./_lib/pulse.js";
import { planJourney, sendDue } from "./_lib/journey.js";
import { snapshot } from "./_lib/scoreboard.js";
import { stepById } from "./_lib/words.js";

/**
 * The hourly job (`vercel.json`, `0 * * * *`). Vercel calls it with
 * `CRON_SECRET` as a bearer token; a person can call it the same way to run
 * it now.
 *
 *   1. Trials ending within 48 hours: a quiet card on the board, once per trial.
 *   2. Members quiet for 10 days: the "we miss you" step, once a month each,
 *      only once Leah's copy is in (`quiet_10` enabled in words.js).
 *   3. The Welcome Journey's due steps, sent.
 *   4. The scoreboard's snapshot from Stripe.
 *
 * Each part keeps its own note and never stops the next; the run's notes are
 * kept on `cc_stats` for the Setup page.
 */

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!cronAuthorized(req)) return res.status(401).json({ error: "unauthorized" });
  if (!admin) return res.status(503).json({ error: "not_open" });
  const started = Date.now();
  const now = new Date();
  const notes = {};

  try {
    const ending = await trialsEndingWithin(admin, 48, now);
    let made = 0;
    for (const trial of ending) {
      const member = await memberById(admin, trial.user_id);
      const { inserted } = await recordPulse(admin, {
        kind: "trial_ending",
        user_id: trial.user_id,
        first_name: member?.firstName || "",
        detail: { ends: trial.current_period_end },
        quiet: true,
        source: "cron",
        source_id: `${trial.stripe_subscription_id || trial.user_id}:trial_ending`,
        occurred_at: now.toISOString()
      });
      if (inserted) made += 1;
    }
    notes.trial_ending = made;
  } catch (error) {
    notes.trial_ending = `error: ${error?.message}`;
  }

  if (stepById("quiet_10")?.enabled) {
    try {
      const quiet = await quietMembers(admin, 10, now);
      const ref = now.toISOString().slice(0, 7);
      let planned = 0;
      for (const userId of quiet.slice(0, 200)) {
        const member = await memberById(admin, userId);
        if (!member) continue;
        planned += await planJourney(admin, { userId, firstName: member.firstName, on: "quiet", at: now, ref });
      }
      notes.quiet = planned;
    } catch (error) {
      notes.quiet = `error: ${error?.message}`;
    }
  } else {
    notes.quiet = "waiting_on_copy";
  }

  try {
    const settings = await settingsOf(admin);
    notes.journey = await sendDue(admin, { settings, base: practiceUrl(), now, deadlineMs: 35_000 });
  } catch (error) {
    notes.journey = `error: ${error?.message}`;
  }

  try {
    notes.stats = await snapshot(admin);
  } catch (error) {
    notes.stats = `error: ${error?.message}`;
  }

  const ms = Date.now() - started;
  await admin.from("cc_stats").update({ cron_ran_at: new Date().toISOString(), cron_note: JSON.stringify({ ...notes, ms }).slice(0, 1000) }).eq("id", true);
  return res.status(200).json({ ok: true, ms, notes });
}
