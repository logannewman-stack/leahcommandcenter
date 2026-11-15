/**
 * The dashboard's trend tiles: a range cut into buckets, and a value per
 * bucket. Pure, so the suite can hold it under plain Node.
 *
 *   daily    the last 14 days, today last
 *   weekly   the last 12 weeks, Monday to Sunday, this week last
 *   monthly  the last 12 months, this month last
 *
 * Days are the viewer's own: a moment at 11pm counts on the day it happened
 * where the person looking is.
 */

export const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" }
];

export const PERIOD_COPY = {
  daily: { current: "Today", range: "Last 14 days", unit: "day" },
  weekly: { current: "This week", range: "Last 12 weeks", unit: "week" },
  monthly: { current: "This month", range: "Last 12 months", unit: "month" }
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const startOfDay = (at) => new Date(at.getFullYear(), at.getMonth(), at.getDate());
const addDays = (at, n) => new Date(at.getFullYear(), at.getMonth(), at.getDate() + n);
const startOfWeek = (at) => {
  const day = startOfDay(at);
  const back = (day.getDay() + 6) % 7; // Monday is 0
  return addDays(day, -back);
};
const startOfMonth = (at) => new Date(at.getFullYear(), at.getMonth(), 1);
const dayLabel = (at) => `${MONTHS[at.getMonth()]} ${at.getDate()}`;

/**
 * The buckets of a period, oldest first: `{ start, end, label }`, `end`
 * exclusive.
 *
 * @param {"daily"|"weekly"|"monthly"} period
 * @param {Date} [now]
 */
export function intervals(period, now = new Date()) {
  const out = [];
  if (period === "daily") {
    const today = startOfDay(now);
    for (let i = 13; i >= 0; i -= 1) {
      const start = addDays(today, -i);
      out.push({ start, end: addDays(start, 1), label: dayLabel(start) });
    }
  } else if (period === "monthly") {
    const month = startOfMonth(now);
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(month.getFullYear(), month.getMonth() - i, 1);
      out.push({ start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1), label: MONTHS[start.getMonth()] });
    }
  } else {
    const week = startOfWeek(now);
    for (let i = 11; i >= 0; i -= 1) {
      const start = addDays(week, -7 * i);
      out.push({ start, end: addDays(start, 7), label: dayLabel(start) });
    }
  }
  return out;
}

/**
 * One value per bucket: a count of the items in it, or the sum of `value`.
 *
 * @param {{ start: Date, end: Date, label: string }[]} buckets
 * @param {any[]} items
 * @param {(item: any) => string|Date|null|undefined} dateOf
 * @param {(item: any) => number} [value]
 * @returns {{ label: string, value: number }[]}
 */
export function series(buckets, items, dateOf, value) {
  const totals = buckets.map(() => 0);
  if (!buckets.length) return [];
  const first = buckets[0].start.getTime();
  const last = buckets[buckets.length - 1].end.getTime();
  for (const item of items || []) {
    const raw = dateOf(item);
    const at = raw instanceof Date ? raw.getTime() : Date.parse(String(raw || ""));
    if (!Number.isFinite(at) || at < first || at >= last) continue;
    const index = buckets.findIndex((b) => at >= b.start.getTime() && at < b.end.getTime());
    if (index !== -1) totals[index] += value ? Number(value(item)) || 0 : 1;
  }
  return buckets.map((bucket, i) => ({ label: bucket.label, value: totals[i] }));
}

/** Whether a moment happened today, where the viewer is. */
export function isToday(iso, now = new Date()) {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return false;
  return startOfDay(at).getTime() === startOfDay(now).getTime();
}
