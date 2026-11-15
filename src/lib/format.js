/** Small formatters the screens share. */

export function money(cents, currency = "usd", { whole = true } = {}) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      maximumFractionDigits: whole ? 0 : 2
    }).format((Number(cents) || 0) / 100);
  } catch {
    return `$${((Number(cents) || 0) / 100).toFixed(whole ? 0 : 2)}`;
  }
}

export function timeAgo(iso, now = Date.now()) {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return "";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateTime(iso) {
  const at = new Date(iso);
  return Number.isFinite(at.getTime()) ? at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

export function dateShort(iso) {
  const at = new Date(iso);
  return Number.isFinite(at.getTime()) ? at.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
}

export const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

export const compact = (n) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);
