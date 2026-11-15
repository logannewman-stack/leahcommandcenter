import { CheckCircle2, Clock, Gift, Handshake, HeartHandshake, Megaphone, ShoppingBag, Sparkles, Trophy, UserPlus } from "lucide-react";

/**
 * Each kind of moment on the board: its icon, its tone and what its badge
 * says. One table, so the feed, the dashboard and the badges never disagree.
 */
export const KINDS = {
  join: { icon: UserPlus, tone: "navy", label: "New member" },
  upgrade: { icon: Sparkles, tone: "gold", label: "Upgraded" },
  merch: { icon: ShoppingBag, tone: "green", label: "Merch" },
  gift: { icon: Gift, tone: "plum", label: "Gift" },
  trial_ending: { icon: Clock, tone: "amber", label: "Trial ending" },
  cancel: { icon: HeartHandshake, tone: "rust", label: "Cancelled" },
  referral: { icon: Handshake, tone: "green", label: "Referral" },
  checkoff: { icon: CheckCircle2, tone: "navy", label: "Task done" },
  shoutout: { icon: Megaphone, tone: "gold", label: "Shout out" },
  milestone: { icon: Trophy, tone: "gold", label: "Milestone" }
};

export const kindOf = (kind) => KINDS[kind] || { icon: Sparkles, tone: "ink", label: "Moment" };

/** The feed's filters: everything, members, the shop, and what needs a person. */
export const VIEWS = [
  { id: "all", label: "Everything", kinds: null },
  { id: "members", label: "Members", kinds: ["join", "upgrade"] },
  { id: "shop", label: "Shop", kinds: ["merch", "gift"] },
  { id: "needs", label: "Needs you", kinds: ["trial_ending", "cancel"] }
];

export const viewOf = (id) => VIEWS.find((view) => view.id === id) || VIEWS[0];

/** "9:42 AM". */
export const clock = (iso) => {
  const at = new Date(iso);
  return Number.isFinite(at.getTime()) ? at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
};
