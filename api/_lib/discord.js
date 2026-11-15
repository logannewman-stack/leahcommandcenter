/**
 * #wins: one line per moment, through a channel webhook. First name and
 * city, and what happened; the webhook can post nothing else and mention
 * nobody (`allowed_mentions` is empty on every post).
 */

const SEND_TIMEOUT_MS = 8000;

export const discordConfigured = () => Boolean(process.env.DISCORD_WINS_WEBHOOK_URL);

/**
 * @param {string} content
 * @returns {Promise<{ sent: boolean, skipped: boolean, error: string }>}
 */
export async function postWins(content, { fetcher = fetch } = {}) {
  const url = process.env.DISCORD_WINS_WEBHOOK_URL || "";
  if (!url) return { sent: false, skipped: true, error: "no_discord_webhook" };
  const text = String(content || "").trim();
  if (!text) return { sent: false, skipped: true, error: "nothing_to_say" };
  try {
    const response = await fetcher(`${url}${url.includes("?") ? "&" : "?"}wait=true`, {
      method: "POST",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: text.slice(0, 1900), username: "The Practice", allowed_mentions: { parse: [] } })
    });
    return response.ok ? { sent: true, skipped: false, error: "" } : { sent: false, skipped: false, error: `discord_${response.status}` };
  } catch (error) {
    return { sent: false, skipped: false, error: String(error?.message || "failed") };
  }
}
