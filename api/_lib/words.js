/**
 * Every word a member receives, and every line the team reads on the feed or
 * in Discord. In one file, so Leah's copy is edited here and nowhere else.
 *
 * The emails are Leah's own, from "The Practice Email Automation Guide"
 * (November 16), word for word; the texts are hers from the build brief. A
 * step marked `draft: true` would have words drafted in her voice that wait
 * for her OK: an admin turns it on from the Journey page
 * (`cc_settings.journey_approved`).
 *
 * The Practice's OS rules hold here too: the situation is neutral and nothing
 * shames. Leah's "if you haven't explored the Lab yet" is an invitation, never
 * a count of what someone missed. See AGENTS.md.
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
 * The Welcome Journey, step by step, as "The Practice Email Automation
 * Guide" lays it out (November 16): Day 0 the welcome and the first rep,
 * Day 1 Leah's story and the Practice Coach, Day 3 the Lab, Day 5 the merch,
 * the day before the trial ends, the moment someone becomes a paying member,
 * and a check-in after a quiet week. Plus the in-app nudge on Day 1 and the
 * thank-you for a merch order, which the guide leaves as they were.
 *
 * `after` is when it goes, in days after the join (or the upgrade, or the
 * order). `on` is what plans it: "join" plans the series, "upgrade" and
 * "merch" plan their one message each, "quiet" is the hourly job's own. The
 * trial reminder goes 24 hours before the trial's own end when Stripe says
 * when that is (`planFor`).
 *
 * Every step here is Leah's own copy, so every step sends. `draft: true`
 * (none right now) would mark words drafted in her voice that wait for her
 * OK on the Journey page (`cc_settings.journey_approved`).
 */
export const STEPS = [
  { id: "welcome", on: "join", after: 0, channels: ["email", "sms"], enabled: true, label: "Welcome to The Practice" },
  { id: "day1_rep", on: "join", after: 1, channels: ["push"], enabled: true, label: "Try today's Rep of the Day" },
  { id: "day1_story", on: "join", after: 1, channels: ["email"], enabled: true, label: "Why I created The Practice" },
  { id: "day3_lab", on: "join", after: 3, channels: ["email"], enabled: true, label: "Have you discovered the Lab yet?" },
  { id: "day5_merch", on: "join", after: 5, channels: ["email"], enabled: true, label: "More than merch. A movement." },
  { id: "day6_trial", on: "join", after: 6, channels: ["email", "sms"], enabled: true, label: "Your trial ends tomorrow" },
  { id: "upgrade", on: "upgrade", after: 0, channels: ["email"], enabled: true, label: "You're officially in" },
  { id: "merch_order", on: "merch", after: 0, channels: ["email"], enabled: true, label: "Thank you for your order" },
  { id: "quiet_7", on: "quiet", after: 0, channels: ["email"], enabled: true, label: "A little reminder: you matter, too" }
];

/**
 * Steps renamed when the schedule moved. A row planned under an old name
 * (a member who joined before November 16) still sends, as the step it
 * became, and an approval given under the old name still counts.
 */
export const RENAMED = { day2_merch: "day5_merch", day4_lab: "day3_lab", quiet_10: "quiet_7" };

export const stepById = (id) => STEPS.find((step) => step.id === (RENAMED[id] || id)) || null;

/** Whether a step sends: Leah's own copy always; a draft once an admin has turned it on. */
export function stepIsOn(step, settings = {}) {
  if (!step) return false;
  if (step.enabled) return true;
  const approved = Array.isArray(settings?.journey_approved) ? settings.journey_approved : [];
  const oldNames = Object.keys(RENAMED).filter((old) => RENAMED[old] === step.id);
  return Boolean(step.draft && (approved.includes(step.id) || oldNames.some((old) => approved.includes(old))));
}

/**
 * The steps one event plans, with when each is due. `trialEnd` (from
 * Stripe) puts the trial reminder exactly 24 hours before the trial ends.
 *
 * @param {string} on
 * @param {Date|string} [at]
 * @param {{ trialEnd?: string|null }} [options]
 */
export function planFor(on, at = new Date(), { trialEnd = null } = {}) {
  const start = at instanceof Date ? at.getTime() : new Date(at).getTime();
  const end = trialEnd ? Date.parse(trialEnd) : NaN;
  return STEPS.filter((step) => step.on === on).flatMap((step) => {
    let due = start + step.after * DAY;
    if (step.id === "day6_trial" && Number.isFinite(end)) due = Math.max(start, end - DAY);
    return step.channels.map((channel) => ({ step: step.id, channel, due_at: new Date(due).toISOString() }));
  });
}

/** Leah's sign-offs, as each email in the guide ends; "The Practice" when the sender is set to it. */
function signed(sender, line) {
  if (sender === "The Practice") return "With love,\nThe Practice by InnerBoard";
  return `With love,\n${line}`;
}

/**
 * The message for a step, in Leah's words: "The Practice Email Automation
 * Guide", word for word. `{{first_name}}` is the member's first name, or
 * "there" when the app has none.
 *
 * @param {string} id
 * @param {{ first: string, base: string, sender?: string, items?: string[] }} input
 * @returns {{ subject: string, title: string, paragraphs: string[], button: string, url: string, signoff: string, sms?: string, push?: { title: string, body: string, url: string } } | null}
 */
export function messageFor(id, { first, base, sender = "Leah", items = [] }) {
  const root = String(base || "").replace(/\/+$/, "");
  const name = first || "there";
  const plain = sender === "The Practice" ? "The Practice" : "Leah";
  switch (RENAMED[id] || id) {
    case "welcome":
      return {
        subject: "Welcome to The Practice. Your life deserves this. 🤍",
        title: `Hey ${name}!`,
        paragraphs: [
          "Welcome to The Practice! 🤍",
          "I'm so glad you're here. And I'm even more excited about what we're going to create together.",
          "First, I want you to know something.",
          "You're already successful.",
          "You've accomplished things. You've overcome challenges. You've figured things out. You've probably become really good at getting through your life.",
          "But how good are you at actually living it?",
          "That's the question at the heart of The Practice.",
          "Because I believe you deserve a life that feels as good as it looks. A life where success isn't just measured by what you accomplish, but by how you experience the life you're creating.",
          "More joy. More connection. More fulfillment. More intention. Not someday. Not when you reach the next milestone. Right now. In the life you're already living.",
          "That's what we're here to practice. And you don't have to figure it all out on your own.",
          "Let's start with your very first rep! Open The Practice and find today's Rep of the Day. Small, intentional actions practiced consistently can change the way you experience your life.",
          "Did you do your first rep? What did you notice? Reply and tell me. I'd love to hear from you!",
          "This isn't just an app. It's a community of people choosing to engage with their lives, not escape them.",
          "You get one life. Let's get good at living it."
        ],
        button: "Open The Practice",
        url: `${root}${PATHS.today}`,
        signoff: signed(sender, "Leah 🤍\nFounder, The Practice by InnerBoard"),
        sms: `Hi ${name}, it's ${plain === "Leah" ? "Leah" : "The Practice"}! Thank you for joining The Practice. You are part of this movement now and I am so glad you are here. Start with today's Rep of the Day: ${root}${PATHS.today}. Reply STOP to opt out.`
      };
    case "day1_rep":
      return {
        subject: "Today's Rep of the Day",
        title: "Today's Rep of the Day is up.",
        paragraphs: ["Try it, then ask the Practice Coach a starter question."],
        button: "Open the Rep of the Day",
        url: `${root}${PATHS.today}`,
        signoff: plain,
        push: { title: "Today's Rep of the Day", body: "Try it, then ask the Practice Coach a starter question.", url: `${root}${PATHS.today}` }
      };
    case "day1_story":
      return {
        subject: "Can I tell you why I created The Practice?",
        title: `Hey ${name}!`,
        paragraphs: [
          "Can I share something personal with you?",
          "For a long time, I was really good at achieving. I knew how to set goals, work hard, accomplish things, and keep moving forward. And from the outside, my life looked pretty darn good.",
          "But here's what I couldn't understand: Why didn't it always feel as good as it looked?",
          "I thought the answer was to do more. Achieve more. Build more. Become more. And the more I did, the more I found myself chasing the very feelings I thought those accomplishments would give me: joy, fulfillment, happiness, peace.",
          "Somewhere along the way, I realized something that changed everything. I didn't need to accomplish more to experience more of my life. I needed to learn how to live the life I already had.",
          "And that takes practice.",
          "That's why I created The Practice. Not because I have life all figured out. Trust me, I don't! But because I believe we can get better at living. Better at navigating challenges, relationships, and managing our minds, emotions, and energy.",
          "So here's my question for you today: Where in your life are you doing a whole lot, but not necessarily experiencing what you hoped all that doing would give you?",
          "Take that question to your Practice Coach. Open the app, share what's on your mind, and give yourself a little space to explore it.",
          "And if you haven't done your Rep of the Day yet, there's no better time than today. We're not chasing perfection here. We're practicing.",
          "I'd love to hear what comes up for you. Reply and tell me what you're discovering."
        ],
        button: "Talk to your Practice Coach",
        url: `${root}${PATHS.coach}`,
        signoff: signed(sender, "Leah 🤍")
      };
    case "day3_lab":
      return {
        subject: "Have you discovered the Lab yet? You’re going to love this. 🤍",
        title: `Hey ${name}!`,
        paragraphs: [
          "Have you explored the Lab inside The Practice yet? Because if you haven't, you're in for something pretty special!",
          "Sometimes all it takes is a new perspective, a little science, a powerful tool, or a conversation to help us see something we've never seen before.",
          "That's exactly why we created the Lab. This is where learning meets real life.",
          "Each month, we dive into a high-quality, research-based, science-driven Masterclass, bringing together brain science, behavioral research, different philosophies, practical methods, and tools you can apply right away.",
          "Your health. Your relationships. Your career. Your leadership. Your finances. Your happiness. Your next chapter. Whatever you're creating, the principles can support your journey.",
          "Inside the Lab, you'll find a monthly live Masterclass, replays if you can't make it, downloadable workbooks, audio notes, the Tool Drop, and two live coaching calls every month with real coaches.",
          "And you don't have to be the person getting coached to learn something powerful. Sometimes someone else's question is exactly the conversation you didn't know you needed.",
          "Most importantly, you belong here. Bring a question, share a perspective, or simply listen. Your experiences and insights matter, too. We can learn from you just as much as you can learn from others.",
          "That's what makes community powerful. We don't just grow individually. We grow together.",
          "So come explore the Lab. Watch a Masterclass. Download a workbook. Join a coaching call. And tell us what you're learning!",
          "We're not here just to gather more information. We're here to turn what we learn into how we live.",
          "You get one life. Let's get good at living it."
        ],
        button: "Open the Lab",
        url: `${root}${PATHS.lab}`,
        signoff: signed(sender, "Leah 🤍")
      };
    case "day5_merch":
      return {
        subject: "It’s more than merch. It’s a movement. 🤍",
        title: `Hey ${name}!`,
        paragraphs: [
          "Life takes reps. And this is a movement worth wearing. 🤍",
          "When you wear The Practice, you're representing something bigger than a brand.",
          "You're reminding yourself, and maybe inspiring someone else, that life isn't just about getting through the day, checking the boxes, or chasing the next accomplishment.",
          "It's about actually living the life you're working so hard to create.",
          "It's about choosing intention over autopilot. Connection over comparison. And remembering that you don't have to accomplish one more thing to deserve more joy, fulfillment, and happiness in your life.",
          "That's what The Practice stands for.",
          "And here's what I love most: You don't have to be a member to be part of this movement.",
          "If you believe your life deserves your attention, if you believe better takes practice, and if you believe we're here to do more than just get through our days, this movement is for you.",
          "So check out the shop, find something you love, and wear it proudly!",
          "And when you do, tag us! We'd love to celebrate you, share your photos, and introduce you to this growing community of people who are doing the work.",
          "You get one life. Let's get good at living it."
        ],
        button: "Shop The Practice",
        url: `${root}${PATHS.club}`,
        signoff: signed(sender, "Leah 🤍\nThe Practice by InnerBoard")
      };
    case "day6_trial":
      return {
        subject: "Your life is worth showing up for. 🤍",
        title: `Hey ${name}!`,
        paragraphs: [
          "Can you believe it's already been a week? Your trial of The Practice wraps up tomorrow, and first, I just want to say thank you for being here. 🤍",
          "I hope you've found something this week that made you think, made you smile, challenged your perspective, or simply reminded you how good it feels to give yourself a little attention.",
          "As you think about continuing with us, there's something I really want you to know: You don't have to do it all.",
          "Think of The Practice like a gym for your life. You don't walk in expecting to use every piece of equipment, take every class, and master every exercise. You find what works for you. You show up. You build strength one rep at a time.",
          "The Practice works the same way.",
          "Maybe it's a morning inspiration or Rep of the Day. Maybe it's five minutes to set an intention, your Sunday Set, one Academy course a month, a Lab Masterclass, a live coaching call, or a conversation with your Practice Coach when life throws you something unexpected.",
          "It doesn't matter where you start. What matters is that you keep showing up.",
          "Life gives us a thousand things competing for our attention. And before we know it, we've spent so much time attending to everything in our lives that we've forgotten to attend to the life we're actually living.",
          "Not another task. Just a little space to remind yourself: My life matters. And I'm going to show up for it.",
          "Even if it's just five minutes. Five minutes to reconnect, get intentional, and remember what matters.",
          "As a full member, you'll continue to have the daily reps, Practice Coach, Academy, Lab, live Masterclasses, coaching, and this incredible community.",
          "We'd love for you to keep practicing with us. You don't have to do everything. Just find something worth coming back to.",
          "You get one life. Let's get good at living it. 🤍"
        ],
        button: "Keep practicing with us",
        url: `${root}${PATHS.membership}`,
        signoff: signed(sender, "Leah\nFounder, The Practice by InnerBoard"),
        sms: `Hi ${name}, it's ${plain === "Leah" ? "Leah" : "The Practice"}. Your trial of The Practice wraps up tomorrow. You don't have to do it all: just find something worth coming back to. ${root}${PATHS.membership}. Reply STOP to opt out.`
      };
    case "upgrade":
      return {
        subject: "You chose your life. Let’s celebrate that! 🤍",
        title: `Hey ${name}!`,
        paragraphs: [
          "YOU'RE OFFICIALLY IN! 🎉🤍",
          "Welcome to The Practice! And congratulations on making a decision that I hope will change the way you experience your life.",
          "Because here's what I love about what you just did: You chose to show up for your own life.",
          "Not because something is wrong or because you need another thing on your to-do list, but because you recognize that your life is worth your time, your energy, and your attention. That's worth celebrating!",
          "It's so easy to get caught up in the rinse and repeat of life. Wake up. Get things done. Take care of people. Meet expectations. Go to bed. Do it again.",
          "Before we know it, we're getting really good at managing our lives without necessarily experiencing them. Trust me, I know this one all too well!",
          "What's easy to do is also easy not to do.",
          "It's easy to take five minutes to get intentional about your day. It's also easy to skip it. It's easy to pause and question a thought. It's also easy to keep thinking it.",
          "That's where The Practice comes in. We're not here to overhaul your life overnight. We're here to help you practice living it, one intentional rep at a time.",
          "Maybe it's morning inspiration, your Sunday Set, your Practice Coach, a Masterclass, or a moment to reconnect with what matters. The more you practice, the more natural it becomes, until intention becomes part of who you are and how you live.",
          "And you're joining a community of people who believe life is meant to be experienced, not just accomplished. We can't wait to learn from you, too.",
          "Celebrate this decision. Get excited about what's possible. And keep showing up.",
          "You get one life. Let's get good at living it! 🤍"
        ],
        button: "Let's get practicing!",
        url: `${root}${PATHS.today}`,
        signoff: signed(sender, "Leah\nFounder, The Practice by InnerBoard")
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
        signoff: plain
      };
    case "quiet_7":
      return {
        subject: "A little reminder. You matter, too. 🤍",
        title: `Hey ${name}!`,
        paragraphs: [
          "I've been thinking about you and wanted to check in. 🤍",
          "I get it. Life gets full!",
          "Between work, relationships, responsibilities, laundry, social media, the never-ending to-do lists, and everything else competing for your attention, it's easy to get caught up in the doing of life. And before you know it, another day has come and gone.",
          "Life will life. I know that all too well!",
          "And I'm not here to tell you to do more, try harder, or add one more thing to your already full plate.",
          "I'm simply here to invite you back into a life that deserves a little of your attention, too. Your life.",
          "That's what The Practice is all about. Not doing everything. Not getting it perfect. Not even having some big breakthrough every time you open the app.",
          "Just giving yourself a few intentional minutes to reconnect with the life you're living.",
          "Maybe it's today's Rep of the Day. Maybe it's a little inspiration. Maybe it's setting an intention for how you want to show up. It doesn't really matter where you start.",
          "What matters is that you give yourself a chance. A chance to pause. A chance to be intentional. A chance to remember that you matter in the middle of everything else that matters to you.",
          "You can come back anytime. No catching up. No starting over. No guilt. Just another opportunity to show up for yourself and the life you're creating.",
          "Give yourself five minutes today. Not because you have to. Because you're worth it.",
          "I'll be practicing right alongside you. 🤍"
        ],
        button: "Take today's rep",
        url: `${root}${PATHS.today}`,
        signoff: signed(sender, "Leah\nFounder, The Practice by InnerBoard")
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
export const BANNED_WORDS = ["private", "choice point", "pressure", "under pressure", "drift", "steadiness", "enterprise", "employees"];

/** A scold: a gap named or counted ("you haven't practiced in 9 days", "you missed"). Leah's invitations are not. */
export const SCOLDS = [/you haven[’']t (practiced|been|opened|logged|checked|shown)/i, /you missed/i, /\d+ days? (since|without)/i];
