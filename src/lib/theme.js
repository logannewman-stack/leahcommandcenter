import { useCallback, useEffect, useState } from "react";
import { THEME_CHOICE_KEY, THEME_COLOR } from "@/lib/nav";

/**
 * Light and dark, as the Detail on Demand Command Center does them: the
 * device decides until someone picks, and from then on their pick sticks
 * on this device.
 */

const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

const readChoice = () => {
  try {
    const value = window.localStorage.getItem(THEME_CHOICE_KEY);
    return value === "dark" || value === "light" ? value : "";
  } catch {
    return "";
  }
};

/** Whether the app opens dark: the pick if there is one, else the device. */
export function initialDark() {
  const choice = readChoice();
  if (choice) return choice === "dark";
  return Boolean(media()?.matches);
}

/** Puts a theme on the page: the class every token reads, and the browser chrome's color. */
export function applyDark(dark) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = dark ? THEME_COLOR.dark : THEME_COLOR.light;
}

/** The theme, and a toggle that remembers the pick. */
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const query = media();
    if (!query) return undefined;
    const follow = (event) => {
      if (readChoice()) return;
      applyDark(event.matches);
      setDark(event.matches);
    };
    query.addEventListener?.("change", follow);
    return () => query.removeEventListener?.("change", follow);
  }, []);

  const toggle = useCallback(() => {
    setDark((now) => {
      const next = !now;
      try {
        window.localStorage.setItem(THEME_CHOICE_KEY, next ? "dark" : "light");
      } catch {
        // Storage blocked: the pick lasts the page.
      }
      applyDark(next);
      return next;
    });
  }, []);

  return { dark, toggle };
}
