import { firstNameOf } from "./words.js";

/**
 * Whose moment this is.
 *
 * The one place the Command Center reads a member's own row: a Stripe
 * customer becomes a Practice account through `memberships`, and the account
 * gives a first name for the feed and, for the Welcome Journey only, an
 * address to write to. Nothing read here is kept on this app's tables but
 * the first name.
 */

/** @typedef {{ userId: string, firstName: string, fullName: string, email: string, phone: string, smsOptIn: boolean, status: string }} Member */

/** The member for a Practice account id, or null. */
export async function memberById(db, userId) {
  if (!db || !userId) return null;
  const { data: profile } = await db.from("profiles").select("id, full_name, email, reminder_phone, reminder_sms").eq("id", userId).maybeSingle();
  if (!profile) return null;
  let email = String(profile.email || "").toLowerCase();
  if (!email) {
    // A profile made before the app kept the address on it: the account has it.
    try {
      const { data } = await db.auth.admin.getUserById(userId);
      email = String(data?.user?.email || "").toLowerCase();
    } catch {
      email = "";
    }
  }
  const { data: membership } = await db.from("memberships").select("status").eq("user_id", userId).maybeSingle();
  return {
    userId: profile.id,
    firstName: firstNameOf(profile.full_name),
    fullName: String(profile.full_name || ""),
    email,
    phone: String(profile.reminder_phone || ""),
    smsOptIn: Boolean(profile.reminder_sms) && Boolean(profile.reminder_phone),
    status: String(membership?.status || "none")
  };
}

/**
 * The member a Stripe customer is: by the customer id the Practice app
 * keeps on the membership row, else the account id the Practice puts on
 * every subscription it makes (`hint`).
 */
export async function memberForCustomer(db, customerId, hint = "") {
  if (!db) return null;
  if (customerId) {
    const { data } = await db.from("memberships").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
    if (data?.user_id) return memberById(db, data.user_id);
  }
  if (hint && /^[0-9a-f-]{36}$/i.test(hint)) return memberById(db, hint);
  return null;
}

/** The member at an address, or null: a merch order from the shop's guest checkout may be nobody's account. */
export async function memberByEmail(db, email) {
  const address = String(email || "").trim().toLowerCase();
  if (!db || !address) return null;
  const { data } = await db.from("profiles").select("id").eq("email", address).limit(1).maybeSingle();
  return data?.id ? memberById(db, data.id) : null;
}

/** The members whose trial ends within the window, with when. */
export async function trialsEndingWithin(db, hours, now = new Date()) {
  const from = now.toISOString();
  const to = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("memberships")
    .select("user_id, stripe_subscription_id, current_period_end")
    .eq("status", "trialing")
    .gte("current_period_end", from)
    .lte("current_period_end", to)
    .limit(500);
  return data || [];
}

/**
 * Members who have not practised in `days` days: every open membership, less
 * everyone with a practice day in the window. A count of days is all this
 * reads, never what was practised.
 */
export async function quietMembers(db, days, now = new Date()) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sinceDay = since.toISOString().slice(0, 10);
  const { data: open } = await db.from("memberships").select("user_id, updated_at").in("status", ["active", "trialing", "past_due"]).limit(2000);
  if (!open?.length) return [];
  const ids = open.map((row) => row.user_id);
  const active = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data } = await db.from("practice_days").select("user_id").in("user_id", slice).gte("day", sinceDay).limit(5000);
    for (const row of data || []) active.add(row.user_id);
  }
  // Somebody who joined inside the window has not been quiet for ten days yet.
  return open.filter((row) => !active.has(row.user_id) && new Date(row.updated_at).getTime() < since.getTime()).map((row) => row.user_id);
}
