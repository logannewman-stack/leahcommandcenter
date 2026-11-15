/**
 * The Command Center's navigation, as data: the sidebar, the phone menu, the
 * dashboard's screen tiles and the tests all read this one list. Pure (no
 * React, no browser), so the suite can hold it under plain Node.
 *
 * Grouped the way the Detail on Demand Command Center groups its own:
 * Overview (the day and the team's to-dos), Members (what members receive),
 * Team (who owns what, the thank yous, the Dream Board and what is
 * connected). Only screens that work are listed.
 */

export const APP_NAME = "Command Center";
export const ORG_NAME = "The Practice";

/** Written the first time someone picks light or dark; until then the device decides. */
export const THEME_CHOICE_KEY = "cc.theme";

/** The browser chrome's color, per theme: the Practice's ivory and its charcoal. */
export const THEME_COLOR = { light: "#F2ECE0", dark: "#1B1916" };

export const NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { key: "dashboard", path: "/", label: "Dashboard", hint: "What needs you, today, and the trends" },
      { key: "todos", path: "/todos", label: "To-dos", hint: "The team's list, and what's done", badge: { key: "myTodos", what: "due" } },
      { key: "pulse", path: "/pulse", label: "Live Pulse", hint: "Every member moment as it happens", badge: { key: "needsYou", what: "need you" } }
    ]
  },
  {
    id: "members",
    label: "Members",
    items: [
      { key: "journey", path: "/journey", label: "Welcome Journey", hint: "Emails, texts and what went out", badge: { key: "journeyFailed", what: "didn't send" } }
    ]
  },
  {
    id: "team",
    label: "Team",
    items: [
      { key: "team", path: "/team", label: "Roles", hint: "Who owns what" },
      { key: "thanks", path: "/thanks", label: "Gratitude Wall", hint: "Thank a teammate for something specific" },
      { key: "dream", path: "/dream", label: "Dream Board", hint: "The vision, the big goals, the milestones" },
      { key: "setup", path: "/setup", label: "Setup", hint: "What is connected" }
    ]
  }
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** The nav item a path belongs to; an unknown path is the dashboard (the router sends it there). */
export function activeItem(pathname = "/") {
  const path = String(pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  return NAV_ITEMS.find((item) => item.path === path) || NAV_ITEMS[0];
}

/** The browser tab's title: "Live Pulse · Command Center". */
export function documentTitle(item) {
  return `${item?.label || NAV_ITEMS[0].label} · ${APP_NAME}`;
}

/** A count for a nav item, from the shared counts, or 0. */
export function badgeCount(item, counts = {}) {
  return item?.badge ? Number(counts[item.badge.key]) || 0 : 0;
}
