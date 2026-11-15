/**
 * Sending to a person: an email (Resend), a text (Twilio), the way the
 * Practice app sends its reminders, and in the same palette.
 *
 * Every send returns `{ sent, skipped, error }` and never rejects: a
 * deployment without an email key is the normal state until the key is in,
 * and the hourly job must not fail its run over a channel nobody set up.
 */

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "The Practice <practice@innerboard.com>";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || "";

export const emailConfigured = () => Boolean(RESEND_KEY);
export const smsConfigured = () => Boolean(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);

const SEND_TIMEOUT_MS = 10_000;

const skip = (why) => ({ sent: false, skipped: true, error: why });
const failed = (why) => ({ sent: false, skipped: false, error: String(why || "failed") });
const done = () => ({ sent: true, skipped: false, error: "" });

export const looksLikeEmail = (value) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(value || "").trim());

/** E.164, which is what every sender wants and what a person rarely types. */
export function toE164(value, fallbackCountry = "1") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+${fallbackCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith(fallbackCountry)) return `+${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : "";
}

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The Practice's light palette, written out: an email cannot read the stylesheet. */
export const EMAIL = {
  canvas: "#f2ece0",
  ink: "#1b1916",
  inkMuted: "#4b4540",
  inkFaint: "#67605a",
  accent: "#1b2332",
  accentInk: "#f8f5ee"
};

/**
 * The body of a journey email: a title, a few short paragraphs, one button,
 * a sign-off and the footer, set as the Practice's own reminders are set.
 *
 * @param {{ title: string, paragraphs: string[], url: string, button: string, signoff?: string, footer?: string }} input
 * @returns {{ text: string, html: string }}
 */
export function emailBody({ title, paragraphs = [], url, button, signoff = "", footer = "" }) {
  const lines = paragraphs.map((p) => String(p || "").trim()).filter(Boolean);
  const text = [title, "", ...lines.flatMap((p) => [p, ""]), `${button}: ${url}`, "", signoff, "", footer].filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n").trim();
  const para = (p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${EMAIL.inkMuted}">${escapeHtml(p)}</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:${EMAIL.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${EMAIL.ink}">
<div style="max-width:480px;margin:0 auto">
<p style="margin:0 0 14px;font-family:Fraunces,Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;line-height:1.25;letter-spacing:-0.2px">${escapeHtml(title)}</p>
${lines.map(para).join("\n")}
<a href="${escapeHtml(url)}" style="display:inline-block;margin:6px 0 18px;background:${EMAIL.accent};color:${EMAIL.accentInk};text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:10px">${escapeHtml(button)}</a>
${signoff ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${EMAIL.ink};white-space:pre-line">${escapeHtml(signoff)}</p>` : ""}
${footer ? `<p style="margin:0;font-size:12px;line-height:1.5;color:${EMAIL.inkFaint}">${escapeHtml(footer)}</p>` : ""}
</div></body></html>`;
  return { text, html };
}

/**
 * One email, through Resend. `once` is Resend's idempotency key: the same
 * key twice is one email, however many times the job runs.
 */
export async function sendEmail({ to, subject, text, html, fromName = "", replyTo = "", once = "" }, { fetcher = fetch } = {}) {
  if (!emailConfigured()) return skip("no_email_provider");
  if (!looksLikeEmail(to)) return skip("no_address");
  const address = MAIL_FROM.replace(/^.*<|>.*$/g, "") || MAIL_FROM;
  const sender = fromName ? `${String(fromName).replace(/[<>"\r\n]/g, "").trim()} <${address}>` : MAIL_FROM;
  const reply = looksLikeEmail(replyTo) ? replyTo : "";
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${RESEND_KEY}`,
        "content-type": "application/json",
        ...(once ? { "Idempotency-Key": String(once).slice(0, 256) } : {})
      },
      body: JSON.stringify({ from: sender, to: [to], subject, text, html, ...(reply ? { reply_to: reply } : {}) })
    });
    return response.ok ? done() : failed(`resend_${response.status}`);
  } catch (error) {
    return failed(error?.message);
  }
}

/** One text, through Twilio. */
export async function sendSms({ to, body }, { fetcher = fetch } = {}) {
  if (!smsConfigured()) return skip("no_sms_provider");
  const number = toE164(to);
  if (!number) return skip("no_number");
  try {
    const response = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      headers: {
        authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ To: number, From: TWILIO_FROM, Body: body })
    });
    return response.ok ? done() : failed(`twilio_${response.status}`);
  } catch (error) {
    return failed(error?.message);
  }
}
