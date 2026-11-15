import { recurringNow, stripeOpen } from "./stripe.js";

/**
 * What only Stripe can say, written to `cc_stats` for the scoreboard: the
 * monthly recurring revenue and the paying count as Stripe has them now.
 * The hourly job's last step.
 */
export async function snapshot(db, { call } = {}) {
  if (!stripeOpen()) return { skipped: "no_stripe" };
  const totals = await recurringNow(call ? { call } : {});
  const { error } = await db.from("cc_stats").update({ mrr_cents: totals.mrr_cents, active_paying: totals.active_paying, trialing: totals.trialing }).eq("id", true);
  if (error) throw new Error(`cc_stats: ${error.message}`);
  return totals;
}
