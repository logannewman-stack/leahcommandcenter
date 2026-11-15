// Milestones are shared with the hourly job: one file, read by both (`api/_lib/milestones.js`).
export * from "../../api/_lib/milestones.js";

/**
 * What a Dream Board goal can follow, and how to read it off the scoreboard.
 * Money is kept in dollars on a goal (Leah types "10000", not cents).
 */
export const METRICS = [
  { id: "members_total", label: "Members", unit: "" },
  { id: "active_paying", label: "Paying members", unit: "" },
  { id: "mrr", label: "Monthly recurring revenue", unit: "$" },
  { id: "upgrades_month", label: "Upgrades this month", unit: "" },
  { id: "trials_month", label: "New trials this month", unit: "" },
  { id: "gifts_total", label: "Holiday gifts", unit: "" },
  { id: "merch_month", label: "Merch this month", unit: "$" },
  { id: "active_7d", label: "Members who practiced this week", unit: "" },
  { id: "practice_days_total", label: "Days practiced, all time", unit: "" },
  { id: "club_spots_total", label: "Club spots taken", unit: "" },
  { id: "manual", label: "A number I keep myself", unit: "" }
];

export const metricOf = (id) => METRICS.find((m) => m.id === id) || METRICS[METRICS.length - 1];

export function goalValue(goal, s = {}) {
  switch (goal?.metric) {
    case "mrr":
      return (Number(s.mrr_cents) || 0) / 100;
    case "merch_month":
      return (Number(s.merch_month_cents) || 0) / 100;
    case "manual":
      return Number(goal.manual_value) || 0;
    default:
      return Number(s[goal?.metric]) || 0;
  }
}

export function goalNumber(value, metric) {
  const unit = metricOf(metric).unit;
  const n = Number(value) || 0;
  const text = n >= 10000 ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n) : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return unit === "$" ? `$${text}` : text;
}
