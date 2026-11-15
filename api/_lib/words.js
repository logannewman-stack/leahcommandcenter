/**
 * Every word a member receives, and every line the team reads on the feed or
 * in Discord. In one file, so Leah's copy is edited here and nowhere else.
 *
 * The emails and the text are the brief's appendix, "written in Leah's voice.
 * Edit freely, especially the personal story line." A step whose copy she has
 * not written yet carries a placeholder and `enabled: false`: it is planned
 * and shown on the Journey page as waiting on copy, and never sent. A step
 * marked `draft: true` has words drafted in her voice and waits for her OK:
 * an admin turns it on from the Journey page (`cc_settings.journey_approved`).
 *
 * The Practice's OS rules hold here too: the situation is neutral, nothing
 * shames, no "you haven't". See AGENTS.md.
 *
 * Plain, importing nothing, so the suite can hold it under plain Node.
 */

/** Where each link goes, on the Practice app. */
export const PATHS = {
  today: "/today",
  coach: "/coach",
  club: "/club",
  lab: "/lab",
  membership: "/profile"
};

/** The first word of a full name, as the feed and the emails say it. */
export function firstNameOf(fullName) {
  const first = String(fullName || "").trim().split(/\s+/)[0] || "";
  // "sarah" → "Sarah"; "SARAH" → "Sarah"; "Sarah-Jane" stays.
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase().replace(/-(\w)/g, (_, c) => `-${c.toUpperCase()}`) : "";
}

/** "Sarah from Denver", or "Sarah", or "A new member". */
export function whoOf(event) {
  const name = String(event?.first_name || "").trim();
  const city = String(event?.city || "").trim();
  if (!name) return "A new member";
  return city ? `${name} from ${city}` : name;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * The Welcome Journey, step by step. `after` is when it goes, in days after
 * the join (or the upgrade, or the order, for the ones that follow those).
 * `on` is what plans it: "join" plans the series, "upgrade" and "merch" plan
 * their one message each, "quiet" is the hourly job's own.
 *
 * `enabled: false` is a step without Leah's copy yet. It is planned, so the
 * Journey page shows it waiting, and skipped when due, with that note.
 */
export const STEPS = [
  { id: "welcome", on: "join", after: 0, channels: ["email", "sms"], enabled: true, label: "Welcome to the movement" },
  { id: "day1_rep", on: "join", after: 1, channels: ["push"], enabled: true, label: "Try today's Rep of the Day" },
  { id: "day2_merch", on: "join", after: 2, channels: ["email"], enabled: true, label: "The merch" },
  { id: "day4_lab", on: "join", after: 4, channels: ["email"], enabled: false, draft: true, label: "Invite to the Lab and the Masterclass" },
  { id: "day6_trial", on: "join", after: 6, channels: ["email", "sms"], enabled: false, draft: true, label: "What stays with you as a full member" },
  { id: "upgrade", on: "upgrade", after: 0, channels: ["email"], enabled: true, label: "You are officially in" },
  { id: "merch_order", on: "merch", after: 0, channels: ["email"], enabled: true, label: "Thank you for your order" },
  { id: "quiet_10", on: "quiet", after: 0, channels: ["email"], enabled: false, draft: true, label: "We miss you" }
];

export const stepById = (id) => STEPS.find((step) => step.id === id) || null;

/** Whether a step sends: Leah's own copy always; a draft once an admin has turned it on. */
export function stepIsOn(step, settings = {}) {
  if (!step) return false;
  if (step.enabled) return true;
  return Boolean(step.draft && Array.isArray(settings?.journey_approved) && settings.journey_approved.includes(step.id));
}

/** The steps one event plans, with when each is due. */
export function planFor(on, at = new Date()) {
  const start = at instanceof Date ? at.getTime() : new Date(at).getTime();
  return STEPS.filter((step) => step.on === on).flatMap((step) =>
    step.channels.map((channel) => ({ step: step.id, channel, due_at: new Date(start + step.after * DAY).toISOString() }))
  );
}

/**
 * The message for a step, in Leah's words.
 *
 * @param {string} id
 * @param {{ first: string, base: string, sender?: string, referralLink?: string, items?: string[] }} input
 * @returns {{ subject: string, title: string, paragraphs: string[], button: string, url: string, signoff: string, sms?: string, push?: { title: string, body: string, url: string } } | null}
 */
export function messageFor(id, { first, base, sender = "Leah", referralLink = "", items = [] }) {
  const root = String(base || "").replace(/\/+$/, "");
  const name = first || "there";
  const signoff = sender === "The Practice" ? "The Practice" : "Leah";
  switch (id) {
    case "welcome":
      return {
        subject: "Welcome to The Practice",
        title: `Hi ${name},`,
        paragraphs: [
          "Thank you for coming into The Practice. We are so glad you are here, and we welcome you into this community.",
          "This movement means so much to me. There was a time I borrowed belief because I could not find my own yet. Now I get to share my belief with you.",
          "Here is what I believe: you deserve to feel better in your life, not just have a life that looks good. Joy is accessible, even in challenge and even in struggle. That is what we practice here.",
          "A great place to start: open today's Rep of the Day, then ask the Practice Coach one question that is on your mind.",
          "And check out the merch. Sport it, wear it, and tag us so we can celebrate you.",
          "Thank you for being part of this movement."
        ],
        button: "Open today's Rep of the Day",
        url: `${root}${PATHS.today}`,
        signoff: `With love,\n${signoff}`,
        sms: `Hi ${name}, it's Leah! Thank you for joining The Practice. You are part of this movement now and I am so glad you are here. Start with today's Rep of the Day: ${root}${PATHS.today}. Reply STOP to opt out.`
      };
    case "day1_rep":
      return {
        subject: "Today's Rep of the Day",
        title: "Today's Rep of the Day is up.",
        paragraphs: ["Try it, then ask the Practice Coach a starter question."],
        button: "Open the Rep of the Day",
        url: `${root}${PATHS.today}`,
        signoff: signoff,
        push: { title: "Today's Rep of the Day", body: "Try it, then ask the Practice Coach a starter question.", url: `${root}${PATHS.today}` }
      };
    case "day2_merch":
      return {
        subject: "Wear the movement",
        title: `Hi ${name},`,
        paragraphs: [
          "When you wear The Practice, you are telling people you chose to feel better in your life. That starts conversations.",
          "Check out the shop. When it shows up, sport it, wear it, and tag us. We love sharing our members."
        ],
        button: "Open the shop",
        url: `${root}${PATHS.club}`,
        signoff: signoff
      };
    case "day4_lab":
      // Drafted in Leah's voice; sent only once she has turned it on.
      return {
        subject: "Come into the Lab",
        title: `Hi ${name},`,
        paragraphs: [
          "You are a few days into The Practice, and I want to make sure you have found the Lab.",
          "The Lab is where we go deeper together. The Coaching Lab lives there, and each month we gather for the Masterclass.",
          "Come as you are. Bring a question, or just listen. Either way, you belong in the room."
        ],
        button: "Open the Lab",
        url: `${root}${PATHS.lab}`,
        signoff: `See you there,\n${signoff}`
      };
    case "day6_trial":
      // Drafted in Leah's voice; sent only once she has turned it on.
      return {
        subject: "What stays with you",
        title: `Hi ${name},`,
        paragraphs: [
          "Your trial wraps up tomorrow, and I wanted to say thank you for practicing with us this week.",
          "As a full member, everything stays with you: the Rep of the Day every morning, the Practice Coach whenever you need it, the Lab, the Masterclass, and this community.",
          "Feeling better is not a one-week thing. It is a practice. I would love for you to keep going with us."
        ],
        button: "Keep going",
        url: `${root}${PATHS.membership}`,
        signoff: `With love,\n${signoff}`,
        sms: `Hi ${name}, it's Leah. Your trial ends tomorrow. As a full member, the Rep of the Day, the Coach and the Lab all stay with you. I would love for you to keep going: ${root}${PATHS.membership}. Reply STOP to opt out.`
      };
    case "upgrade":
      return {
        subject: "You are officially in",
        title: `Hi ${name},`,
        paragraphs: [
          "Thank you for choosing to keep going. You are officially part of The Practice, and that means a lot to me.",
          ...(referralLink
            ? [`Know someone who could use this too? Here is your personal link: ${referralLink}. When they join, you both get a gift from us.`]
            : [])
        ],
        button: "Open The Practice",
        url: `${root}${PATHS.today}`,
        signoff: `So grateful for you,\n${signoff}`
      };
    case "merch_order":
      return {
        subject: "Thank you for your order",
        title: `Thank you for your order, ${name}!`,
        paragraphs: [
          ...(items.length ? [`On its way: ${items.join(", ")}.`] : []),
          "When it arrives, wear it proud and tag us. We cannot wait to see you in it."
        ],
        button: "Open the Practice Club",
        url: `${root}${PATHS.club}`,
        signoff: signoff
      };
    case "quiet_10":
      // Drafted in Leah's voice; sent only once she has turned it on.
      return {
        subject: "One rep",
        title: `Hi ${name},`,
        paragraphs: [
          "I have been thinking about you and wanted to check in.",
          "Life gets full. That is normal, and nothing is lost. The Practice is right here whenever you are ready.",
          "One simple way back in: open today's Rep of the Day. It takes a few minutes, and it counts."
        ],
        button: "Open today's rep",
        url: `${root}${PATHS.today}`,
        signoff: `Thinking of you,\n${signoff}`
      };
    default:
      return null;
  }
}

/** The footer under every journey email: how to stop them, in the app. */
export const EMAIL_FOOTER = "You can manage these emails any time in the app, under You.";

/* ── The feed and Discord ────────────────────────────────────────────────── */

const money = (cents, currency = "usd") => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: String(currency || "usd").toUpperCase(), maximumFractionDigits: 0 }).format(
      (Number(cents) || 0) / 100
    );
  } catch {
    return `$${Math.round((Number(cents) || 0) / 100)}`;
  }
};

const itemsOf = (event) => {
  const items = Array.isArray(event?.detail?.items) ? event.detail.items : [];
  return items
    .map((item) => `${String(item?.name || "").trim()}${Number(item?.quantity) > 1 ? ` × ${Number(item.quantity)}` : ""}`)
    .filter((line) => line.trim())
    .slice(0, 6);
};

/**
 * The line on the board for one event. First name and city, and what
 * happened; nothing else about the person.
 *
 * @param {{ kind: string, first_name?: string, city?: string, detail?: any }} event
 * @returns {{ title: string, body: string }}
 */
export function feedLine(event) {
  const who = whoOf(event);
  const d = event?.detail || {};
  switch (event?.kind) {
    case "join":
      return { title: `Welcome, ${who}!`, body: d.trial === false ? "Joined as a full member." : "Started the 7 day trial." };
    case "upgrade":
      return { title: `${who} is officially in.`, body: `Trial upgraded to the full membership${d.plan === "year" ? ", by the year" : ""}.` };
    case "merch": {
      const items = itemsOf(event);
      return { title: `${who} bought merch.`, body: `${items.length ? items.join(", ") : "An order"}${d.amount_cents ? ` · ${money(d.amount_cents, d.currency)}` : ""}` };
    }
    case "gift":
      return { title: `A gift was purchased${event?.first_name ? ` by ${who}` : ""}.`, body: d.item ? String(d.item) : "Hat plus one year." };
    case "trial_ending":
      return { title: `${who}'s trial ends in 48 hours.`, body: "A good moment for someone to reach out." };
    case "cancel":
      return { title: `${who} cancelled.`, body: d.at_period_end ? "The membership ends with its period. A personal note would mean something." : "The membership ended. A personal note would mean something." };
    case "referral":
      return { title: `${who} brought a friend in.`, body: "A referral converted." };
    case "checkoff":
      return { title: `${who} cleared a task.`, body: String(d.task || "") };
    case "shoutout":
      return { title: `${who} thanked ${String(d.to || "a teammate")}.`, body: String(d.for || "") };
    case "milestone":
      return { title: String(d.title || "A milestone."), body: String(d.body || "") };
    default:
      return { title: String(d.title || "Something happened."), body: String(d.body || "") };
  }
}

/**
 * The post in #wins for one event, or "" for one that does not post (a
 * cancel, a trial ending: those stay on the board). `counts` carries the
 * running totals the brief asks for beside each kind.
 *
 * @param {{ kind: string, first_name?: string, city?: string, detail?: any }} event
 * @param {{ today?: number, month?: number, total?: number }} [counts]
 */
export function discordLine(event, counts = {}) {
  const who = whoOf(event);
  const d = event?.detail || {};
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  switch (event?.kind) {
    case "join":
      return `🎉 Welcome, ${who}!${Number.isFinite(counts.today) ? ` ${plural(counts.today, "new member")} today.` : ""}`;
    case "upgrade":
      return `✨ ${who} is officially a full member.${Number.isFinite(counts.month) ? ` ${plural(counts.month, "upgrade")} this month.` : ""}`;
    case "merch": {
      const items = itemsOf(event);
      return `🧢 ${who} just ordered ${items.length ? items.join(", ") : "merch"}.`;
    }
    case "gift":
      return `🎁 A holiday gift was purchased: ${d.item ? String(d.item) : "hat plus one year"}.${Number.isFinite(counts.total) ? ` ${plural(counts.total, "gift")} so far.` : ""}`;
    case "referral":
      return `🤝 ${who} brought a friend into The Practice.`;
    case "checkoff":
      return `✅ ${who} cleared: ${String(d.task || "a task")}.`;
    case "shoutout":
      return `🙏 ${who} thanked ${String(d.to || "a teammate")}${d.for ? ` for ${String(d.for)}` : ""}.`;
    case "milestone":
      return `🏆 ${String(d.title || "A milestone!")}`;
    default:
      return "";
  }
}

/** The line in #wins when someone clears every to-do due today. */
export function listClearedLine(firstName) {
  return `🎉 ${firstName || "Someone"} cleared today's list.`;
}

/** Which kinds post to #wins at all. */
export const POSTS_TO_DISCORD = new Set(["join", "upgrade", "merch", "gift", "referral", "checkoff", "shoutout", "milestone"]);

/** Words the Practice's OS rules keep out of anything a member reads. */
export const BANNED_WORDS = ["private", "choice point", "pressure", "under pressure", "drift", "steadiness", "enterprise", "employees", "you haven't", "you haven’t"];
