/**
 * The movement's milestones: "38 members away from 500." Read by the board
 * (the countdown) and by the hourly job (the celebration, once each). Plain,
 * so both sides and the suite can hold it.
 */

export const MILESTONES = {
  members: { label: "members", steps: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000] },
  paying: { label: "paying members", steps: [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] },
  // Monthly recurring revenue, in cents: "first $10K month".
  mrr: { label: "a month", steps: [100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000] }
};

/** The highest step reached, or 0. */
export function reached(value, steps) {
  let best = 0;
  for (const step of steps) if (Number(value) >= step) best = step;
  return best;
}

/**
 * The next step and how far away it is, with the step before it for a ring
 * that fills from there.
 *
 * @returns {{ target: number, previous: number, away: number, ratio: number } | null}
 */
export function nextStep(value, steps) {
  const v = Number(value) || 0;
  const target = steps.find((step) => step > v);
  if (!target) return null;
  const previous = reached(v, steps);
  const span = target - previous;
  return { target, previous, away: target - v, ratio: span > 0 ? (v - previous) / span : 0 };
}

const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** The words for a milestone, on the board and in #wins. */
export function milestoneWords(metric, step) {
  if (metric === "members") return { title: `${step.toLocaleString("en-US")} members in The Practice.`, body: "The movement keeps growing. Thank you, team." };
  if (metric === "paying") return { title: `${step.toLocaleString("en-US")} paying members.`, body: "Every one of them chose to keep going." };
  if (metric === "mrr") return { title: `The first ${dollars(step)} month.`, body: "Recurring revenue just crossed it." };
  return { title: "A milestone.", body: "" };
}

/**
 * For the hourly job: the newest step each number has reached, as a pulse
 * row's makings. Only the top step is offered, so a first run celebrates
 * where things stand today rather than every step already behind them; the
 * source id keeps each from landing twice.
 *
 * @param {{ members?: number, paying?: number, mrr_cents?: number }} numbers
 */
export function milestonesFor(numbers) {
  const values = { members: numbers.members, paying: numbers.paying, mrr: numbers.mrr_cents };
  const out = [];
  for (const [metric, { steps }] of Object.entries(MILESTONES)) {
    const step = reached(values[metric], steps);
    if (!step) continue;
    const words = milestoneWords(metric, step);
    out.push({ metric, step, source_id: `milestone:${metric}:${step}`, detail: { metric, step, title: words.title, body: words.body } });
  }
  return out;
}
