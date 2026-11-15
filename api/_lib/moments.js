import { firstNameOf } from "./words.js";

/**
 * Member moments: the 30 day, 90 day, one year and two year marks coming up
 * in the next week, by the day each member's account was made. First names
 * only; the team sees them coming and can say something.
 */

export const MARKS = [30, 90, 365, 730];
const DAY = 24 * 60 * 60 * 1000;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * @param {any} db  the service client
 * @param {Date} now
 * @param {number} [aheadDays]
 */
export async function momentsAhead(db, now = new Date(), aheadDays = 7) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out = [];
  for (const days of MARKS) {
    const from = today - days * DAY;
    const to = from + aheadDays * DAY;
    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, created_at")
      .gte("created_at", new Date(from).toISOString())
      .lt("created_at", new Date(to).toISOString())
      .limit(200);
    if (error) throw new Error(`profiles: ${error.message}`);
    for (const row of data || []) {
      const made = new Date(row.created_at);
      const madeDay = Date.UTC(made.getUTCFullYear(), made.getUTCMonth(), made.getUTCDate());
      out.push({ id: String(row.id).slice(0, 8), first_name: firstNameOf(row.full_name), days, on: isoDay(madeDay + days * DAY) });
    }
  }
  return out.sort((a, b) => a.on.localeCompare(b.on) || b.days - a.days);
}
