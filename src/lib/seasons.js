/**
 * Seasonal celebrations: the month's motif in place of the confetti.
 *
 * Ported as is from the Practice app (`src/lib/seasons.js`), so the board
 * celebrates with the same November leaves, December ornaments and February
 * hearts the members see. A change to a motif belongs there first.
 *
 * Plain, importing nothing with an alias, so the suite can hold it.
 */

const NAVY = "#1B2332";
const GOLD = "#B08D57";
const GOLD_SOFT = "#CBB089";
const BONE = "#E7DCCF";
const PAPER = "#FBF8F3";

export const SEASON_INK = { navy: NAVY, gold: GOLD, goldSoft: GOLD_SOFT, bone: BONE };

/**
 * @typedef {{
 *   month: string, motif: string, shape: string, colors: string[],
 *   tint: string, fall: number, sway: number, spin: number, feel: string
 * }} Season
 */

/** @type {Season[]} January first. */
export const SEASONS = [
  { month: "January", motif: "Snowflakes", shape: "snow", colors: [PAPER, BONE, "#C9D4E0"], tint: "Frost blue", fall: 0.7, sway: 1.2, spin: 0.6, feel: "Quiet and fresh. A clean start." },
  { month: "February", motif: "Hearts", shape: "heart", colors: ["#C98B8B", GOLD_SOFT, BONE], tint: "Rose", fall: 0.8, sway: 1, spin: 0.2, feel: "Warm. Love you generate, for yourself and others." },
  { month: "March", motif: "Shamrocks", shape: "shamrock", colors: ["#6F8F64", "#8FAA7E", GOLD_SOFT], tint: "Clover green", fall: 0.85, sway: 1, spin: 0.6, feel: "A little luck, and something new coming up." },
  { month: "April", motif: "Butterflies", shape: "butterfly", colors: ["#9FB6CF", "#E8C9C9", GOLD_SOFT], tint: "Soft blue and blush", fall: 0.5, sway: 1.8, spin: 0.3, feel: "Light, fluttering, and new." },
  { month: "May", motif: "Flowers", shape: "flower", colors: [PAPER, "#E8C9C9", BONE], tint: "Blush and cream", fall: 0.8, sway: 1, spin: 0.5, feel: "In full bloom." },
  { month: "June", motif: "Suns", shape: "sun", colors: [GOLD_SOFT, GOLD, "#E9CF94"], tint: "Honey", fall: 0.9, sway: 0.6, spin: 0.5, feel: "Bright, long days." },
  { month: "July", motif: "Stars", shape: "star", colors: [GOLD_SOFT, PAPER, "#C9D4E0"], tint: "Night sky", fall: 1, sway: 0.6, spin: 1, feel: "Celebration without the noise." },
  { month: "August", motif: "Sunflowers", shape: "sunflower", colors: ["#D9A93A", GOLD_SOFT, "#E9CF94"], tint: "Sunflower gold", fall: 0.85, sway: 0.8, spin: 0.5, feel: "Late summer, standing tall." },
  { month: "September", motif: "Apples", shape: "apple", colors: ["#B5524A", "#C98B5A", GOLD_SOFT], tint: "Orchard", fall: 1.1, sway: 0.4, spin: 0.4, feel: "Back to the work, with energy." },
  { month: "October", motif: "Pumpkins", shape: "pumpkin", colors: ["#C9783A", "#D99A5B", BONE], tint: "Pumpkin and cream", fall: 0.95, sway: 0.5, spin: 0.4, feel: "Cozy fall, harvest season." },
  { month: "November", motif: "Falling leaves", shape: "leaf", colors: ["#C07A3E", "#A8552F", GOLD_SOFT], tint: "Amber and rust", fall: 0.6, sway: 1.6, spin: 1.1, feel: "Gratitude, and letting go of what's done." },
  { month: "December", motif: "Ornaments", shape: "ornament", colors: ["#8A3B3B", GOLD_SOFT, "#2F5A45"], tint: "Deep red, gold, and evergreen", fall: 0.75, sway: 0.9, spin: 0.5, feel: "Festive and warm at the close of the year." }
];

/** "Classic confetti", for somebody who chose it. */
export const CLASSIC = { month: "", motif: "Confetti", shape: "confetti", colors: [NAVY, GOLD, GOLD_SOFT, BONE], tint: "", fall: 1.1, sway: 0.8, spin: 2, feel: "" };

/** The month it is, 0 for January. */
export function monthIn(at = new Date(), zone = "") {
  if (zone) {
    try {
      const month = Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "numeric" }).format(at));
      if (month >= 1 && month <= 12) return month - 1;
    } catch {
      // An unknown zone: the device's month, below.
    }
  }
  return at.getMonth();
}

export const seasonFor = (at = new Date(), zone = "") => SEASONS[monthIn(at, zone)];

/**
 * How many pieces, how big, and for how long, at a celebration's size: the
 * Practice's own numbers (Logan, November 3: "make them all the way to the
 * bottom").
 */
export function burstOf(bigger) {
  return bigger
    ? { count: 140, size: [9, 18], life: [210, 270], stagger: 0.9 }
    : { count: 90, size: [7, 15], life: [190, 250], stagger: 0.7 };
}

/** The most frames any piece lives: no piece outlasts five seconds. */
export const MOST_FRAMES = 300;

/** How long a burst lasts, in milliseconds. */
export function burstLength(bigger, season) {
  const burst = burstOf(bigger);
  return Math.round((Math.min(MOST_FRAMES, burst.life[1] / Math.sqrt(Math.max(0.25, season?.fall || 1))) / 60) * 1000);
}
