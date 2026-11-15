/**
 * The team's to-dos, as plain functions: dates, due labels, sections and
 * progress. Pure, so the suite holds it under plain Node. Dates are the
 * viewer's own calendar days, "YYYY-MM-DD", the way Postgres keeps `due_on`.
 */

export const REPEATS = [
  { value: "none", label: "Never", short: "" },
  { value: "daily", label: "Every day", short: "Every day" },
  { value: "weekdays", label: "Every weekday", short: "Weekdays" },
  { value: "mwf", label: "Mon, Wed and Fri", short: "Mon · Wed · Fri" },
  { value: "weekly", label: "Every week", short: "Weekly" },
  { value: "monthly", label: "Every month", short: "Monthly" }
];

export const repeatOf = (value) => REPEATS.find((r) => r.value === value) || REPEATS[0];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n) => String(n).padStart(2, "0");

/** A local date as "YYYY-MM-DD". */
export function localISO(at = new Date()) {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** "YYYY-MM-DD" as a local midnight. */
export function dateOf(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso, n) {
  const at = dateOf(iso);
  at.setDate(at.getDate() + n);
  return localISO(at);
}

/** Whole days from `a` to `b` (b − a), ignoring the clock. */
export function daysBetween(a, b) {
  return Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86_400_000);
}

/** The next day a repeating to-do is due after `iso`: the same rule as `cc_next_due()` in Postgres. */
export function nextDue(iso, repeat) {
  if (!iso || repeat === "none") return null;
  if (repeat === "daily") return addDays(iso, 1);
  if (repeat === "weekly") return addDays(iso, 7);
  if (repeat === "monthly") {
    const at = dateOf(iso);
    const day = at.getDate();
    const next = new Date(at.getFullYear(), at.getMonth() + 1, 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
    return localISO(next);
  }
  let at = iso;
  for (let i = 0; i < 8; i += 1) {
    at = addDays(at, 1);
    const dow = dateOf(at).getDay();
    if (repeat === "weekdays" && dow >= 1 && dow <= 5) return at;
    if (repeat === "mwf" && (dow === 1 || dow === 3 || dow === 5)) return at;
  }
  return null;
}

/** "Mon, Nov 24", or with the year when it is not this one. */
export function shortDate(iso, today = localISO()) {
  const at = dateOf(iso);
  const sameYear = at.getFullYear() === dateOf(today).getFullYear();
  return `${DAYS[at.getDay()].slice(0, 3)}, ${MONTHS[at.getMonth()]} ${at.getDate()}${sameYear ? "" : `, ${at.getFullYear()}`}`;
}

/**
 * What a due date says beside a to-do, and how it reads: "Today", "Tomorrow",
 * "Friday", "Mon, Nov 24", "Yesterday", "3 days late".
 *
 * @returns {{ text: string, tone: "late"|"today"|"soon"|"later"|"" }}
 */
export function dueLabel(due, today = localISO()) {
  if (!due) return { text: "", tone: "" };
  const diff = daysBetween(today, due);
  if (diff < 0) return { text: diff === -1 ? "Yesterday" : `${-diff} days late`, tone: "late" };
  if (diff === 0) return { text: "Today", tone: "today" };
  if (diff === 1) return { text: "Tomorrow", tone: "soon" };
  if (diff < 7) return { text: DAYS[dateOf(due).getDay()], tone: "soon" };
  return { text: shortDate(due, today), tone: "later" };
}

/** Which part of the list a to-do belongs in. */
export function sectionOf(task, today = localISO()) {
  if (task.status === "done") return localISO(new Date(task.done_at || Date.now())) === today ? "doneToday" : "doneEarlier";
  if (!task.due_on) return "someday";
  if (task.due_on < today) return "overdue";
  if (task.due_on === today) return "today";
  return "upcoming";
}

export const SECTIONS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Coming up" },
  { id: "someday", label: "Anytime" },
  { id: "doneToday", label: "Done today" },
  { id: "doneEarlier", label: "Done earlier" }
];

const byDue = (a, b) =>
  String(a.due_on || "9999").localeCompare(String(b.due_on || "9999")) ||
  (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
  String(a.created_at || "").localeCompare(String(b.created_at || ""));
const byDone = (a, b) => String(b.done_at || "").localeCompare(String(a.done_at || ""));

/**
 * The list, cut into its sections in order, each sorted: open ones by when
 * they are due, done ones newest first. `hold` keeps a just-checked to-do in
 * the section it was in for a moment, so it is seen checked before it moves.
 *
 * @param {any[]} tasks
 * @param {string} today
 * @param {Map<string, string>} [hold]  id → the section to keep it in
 */
export function groupTasks(tasks, today = localISO(), hold = new Map()) {
  const groups = Object.fromEntries(SECTIONS.map((s) => [s.id, []]));
  for (const task of tasks) {
    const section = hold.get(task.id) || sectionOf(task, today);
    groups[section].push(task);
  }
  for (const s of SECTIONS) groups[s.id].sort(s.id.startsWith("done") ? byDone : byDue);
  return groups;
}

/**
 * A person's day: what is done today and what is still due by today.
 *
 * @returns {{ done: number, left: number, total: number, ratio: number }}
 */
export function progressFor(tasks, email, today = localISO()) {
  let done = 0;
  let left = 0;
  for (const task of tasks) {
    if (email && task.assignee_email !== email) continue;
    const section = sectionOf(task, today);
    if (section === "doneToday") done += 1;
    else if (section === "today" || section === "overdue") left += 1;
  }
  const total = done + left;
  return { done, left, total, ratio: total ? done / total : 0 };
}

/** The quick choices for a due date: today, tomorrow, next Monday, none. */
export function dueChoices(today = localISO()) {
  const dow = dateOf(today).getDay();
  // The Monday after tomorrow's, so it is never the same day as Tomorrow.
  let toMonday = ((8 - dow) % 7) || 7;
  if (toMonday === 1) toMonday = 8;
  return [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next Monday", value: addDays(today, toMonday) },
    { label: "No date", value: null }
  ];
}
