import { admin, appOrigin, practiceUrl, readJsonBody, settingsOf, teamMember } from "./_lib/guard.js";
import { memberById } from "./_lib/members.js";
import { emailConfigured, smsConfigured, emailBody, sendEmail } from "./_lib/notify.js";
import { discordConfigured, postWins } from "./_lib/discord.js";
import { stripeConfig } from "./_lib/stripe.js";
import { WEBHOOK_EVENTS } from "./_lib/pulse.js";
import { EMAIL_FOOTER, STEPS, discordLine, firstNameOf, listClearedLine, messageFor } from "./_lib/words.js";

/**
 * What the team asks the server for. Every address needs a signed-in person
 * on `cc_team`; two need an admin.
 *
 *   GET  /api/admin/health            what is wired up, for the Setup page
 *   GET  /api/admin/member?id=…       one member's contact details, for a personal note (admin)
 *   POST /api/admin/test   { step }   a journey email, sent to the caller's own inbox
 *   POST /api/admin/discord           a line in #wins, to see it land (admin)
 *   POST /api/admin/checkoff { id }   a to-do the caller just finished, in #wins, once
 *
 * One function rather than four: the Hobby plan deploys at most twelve.
 */

export const config = { maxDuration: 20 };

const opOf = (req) => {
  const given = req?.query?.op;
  if (typeof given === "string" && given) return given;
  try {
    const url = new URL(String(req?.url || ""), "http://local");
    return url.searchParams.get("op") || (/^\/api\/admin\/([a-z]+)\/?$/.exec(url.pathname) || [])[1] || "";
  } catch {
    return "";
  }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!admin) return res.status(503).json({ error: "not_open" });
  const me = await teamMember(req);
  if (!me) return res.status(401).json({ error: "not_on_team" });
  const op = opOf(req);

  if (op === "health" && req.method === "GET") {
    const { secret, webhookSecret } = stripeConfig();
    const [{ data: stats }, { data: keys }, pulse, due, team] = await Promise.all([
      admin.from("cc_stats").select("*").eq("id", true).maybeSingle(),
      admin.from("push_keys").select("id").eq("id", 1).maybeSingle(),
      admin.from("cc_pulse_events").select("id", { count: "exact", head: true }),
      admin.from("cc_journey").select("id", { count: "exact", head: true }).eq("status", "due"),
      admin.from("cc_team").select("email", { count: "exact", head: true }).eq("active", true)
    ]);
    return res.status(200).json({
      you: { name: me.name, email: me.email, is_admin: me.is_admin },
      database: true,
      stripe: { key: Boolean(secret), webhook_secret: Boolean(webhookSecret), webhook_url: `${appOrigin(req)}/api/stripe`, events: WEBHOOK_EVENTS },
      email: emailConfigured(),
      sms: smsConfigured(),
      discord: discordConfigured(),
      push: { keys: Boolean(keys?.id) },
      cron: { secret: Boolean(process.env.CRON_SECRET), ran_at: stats?.cron_ran_at || null, note: stats?.cron_note || "" },
      practice_url: practiceUrl(),
      app_url: appOrigin(req),
      counts: { pulse: Number(pulse.count) || 0, journey_due: Number(due.count) || 0, team: Number(team.count) || 0 },
      steps: STEPS.map(({ id, label, enabled, channels, after, on }) => ({ id, label, enabled, channels, after, on }))
    });
  }

  if (op === "member" && req.method === "GET") {
    if (!me.is_admin) return res.status(403).json({ error: "admins_only" });
    const id = String(req.query?.id || new URL(String(req.url || ""), "http://local").searchParams.get("id") || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "bad_request" });
    const member = await memberById(admin, id);
    if (!member) return res.status(404).json({ error: "not_found" });
    const { data: membership } = await admin.from("memberships").select("status, current_period_end, cancel_at_period_end").eq("user_id", id).maybeSingle();
    return res.status(200).json({
      first_name: member.firstName,
      full_name: member.fullName,
      email: member.email,
      status: membership?.status || "none",
      period_end: membership?.current_period_end || null,
      cancels: Boolean(membership?.cancel_at_period_end)
    });
  }

  if (op === "test" && req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return res.status(400).json({ error: "bad_request" });
    }
    const step = STEPS.find((s) => s.id === body.step) || STEPS[0];
    const settings = await settingsOf(admin);
    const message = messageFor(step.id, { first: firstNameOf(me.name), base: practiceUrl(), sender: settings.sender, items: ["The Club Hoodie (Cream) / M"] });
    if (!message) return res.status(400).json({ error: "no_message" });
    const { text, html } = emailBody({ title: message.title, paragraphs: message.paragraphs, url: message.url, button: message.button, signoff: message.signoff, footer: EMAIL_FOOTER });
    const sent = await sendEmail({
      to: me.email,
      subject: `[Test] ${message.subject}`,
      text,
      html,
      fromName: settings.sender === "The Practice" ? "The Practice" : "Leah from The Practice",
      once: `test:${me.email}:${step.id}:${Date.now()}`
    });
    return res.status(sent.sent ? 200 : 503).json({ ...sent, step: step.id, to: me.email, preview: { subject: message.subject, text } });
  }

  if (op === "discord" && req.method === "POST") {
    if (!me.is_admin) return res.status(403).json({ error: "admins_only" });
    const posted = await postWins(`✅ The Practice Command Center is connected to #wins. (${me.name} checked.)`);
    return res.status(posted.sent ? 200 : 503).json(posted);
  }

  if (op === "checkoff" && req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return res.status(400).json({ error: "bad_request" });
    }
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "bad_request" });
    const { data: task } = await admin.from("cc_tasks").select("*").eq("id", id).maybeSingle();
    if (!task) return res.status(404).json({ error: "not_found" });
    // Only the person who checked it off, only once, and only while it is fresh.
    if (task.status !== "done" || task.done_by !== me.email) return res.status(409).json({ error: "not_done_by_you" });
    if (task.announced_at) return res.status(200).json({ already: true });
    if (Date.now() - Date.parse(task.done_at) > 15 * 60 * 1000) return res.status(200).json({ stale: true });
    const { data: claimed } = await admin.from("cc_tasks").update({ announced_at: new Date().toISOString() }).eq("id", id).is("announced_at", null).select("id");
    if (!claimed?.length) return res.status(200).json({ already: true });

    const settings = await settingsOf(admin);
    if (!settings.discord_wins_enabled) return res.status(200).json({ posted: false, reason: "discord_off" });
    const first = firstNameOf(me.name);
    const posted = await postWins(discordLine({ kind: "checkoff", first_name: first, detail: { task: String(task.title).slice(0, 120) } }));

    // Every to-do due by today done: one more line, once a day.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings.time_zone || "America/Chicago" }).format(new Date());
    const { count: left } = await admin
      .from("cc_tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_email", me.email)
      .eq("status", "open")
      .lte("due_on", today);
    let cleared = false;
    if (task.assignee_email === me.email && !left) cleared = (await postWins(listClearedLine(first))).sent;
    return res.status(200).json({ posted: posted.sent, cleared });
  }

  return res.status(404).json({ error: "not_found" });
}
