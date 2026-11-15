import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, RefreshCw, X } from "lucide-react";

/*
 * The Command Center's kit: the Detail on Demand Command Center's pieces
 * (the large-title screen, cards, icon tiles, rows with a count and a
 * chevron, tinted badges, chips, the segmented control, the switch, the
 * notice, the empty state, the sheet), drawn in the Practice's colors by
 * src/styles/command-center.css. `tone` is one of navy · plum · amber ·
 * green · gold · rust · ink.
 */

/**
 * A screen: a sticky bar that turns frosted and shows the title once the
 * large title has scrolled away, the large title with a line under it, and
 * the content. `right` is the bar's actions (Refresh).
 */
export function Page({ title, subtitle, right, children }) {
  const sentinel = useRef(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver !== "function") return undefined;
    const watch = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { threshold: 0 });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return (
    <div>
      <div className={`cc-navbar ${compact ? "is-compact" : ""}`}>
        <div className="cc-navbar-side" />
        <div className="cc-navbar-title t-headline" aria-hidden="true">
          {title}
        </div>
        <div className="cc-navbar-side is-right">{right}</div>
      </div>
      <header className="cc-page-head">
        <div ref={sentinel} />
        <h1 className="t-large">{title}</h1>
        {subtitle ? <p className="t-sub cc-tertiary">{subtitle}</p> : null}
      </header>
      <div className="cc-page-body">{children}</div>
    </div>
  );
}

/** The bar's Refresh: the icon, a spinner while busy, and a label that says which. */
export function RefreshButton({ busy, onClick }) {
  return (
    <button type="button" className="cc-icon-press" onClick={onClick} disabled={busy} aria-busy={busy} aria-label={busy ? "Refreshing" : "Refresh"}>
      {busy ? <Spinner size={18} /> : <RefreshCw size={19} strokeWidth={2.1} aria-hidden="true" />}
    </button>
  );
}

export function Spinner({ size = 20, label }) {
  return <span className="cc-spinner" style={{ width: size, height: size }} role={label ? "status" : undefined} aria-label={label} />;
}

/** A glass card with an h2, so heading navigation finds every block. */
export function Card({ title, caption, children, className = "", flush }) {
  return (
    <section className={`cc-glass cc-card ${flush ? "cc-card-flush" : ""} ${className}`}>
      {title ? (
        <div className="cc-card-head">
          <h2 className="t-headline cc-label">{title}</h2>
          {caption ? <span className="t-cap1 cc-tertiary" style={{ whiteSpace: "nowrap" }}>{caption}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** The colored square a row or a stat leads with. */
export function IconTile({ icon: Icon, tone = "navy", size = 32 }) {
  return (
    <span className={`cc-tile tone-${tone}`} style={{ width: size, height: size, borderRadius: Math.round(size / 4) }} aria-hidden="true">
      <Icon size={Math.round(size * 0.53)} strokeWidth={2.1} />
    </span>
  );
}

export function CountPill({ n, large }) {
  return <span className={`cc-count ${large ? "cc-count-lg" : ""}`}>{n}</span>;
}

/** A tinted status pill with a dot. */
export function Badge({ tone = "ink", children, title }) {
  return (
    <span className={`cc-badge tone-${tone}`} title={title}>
      {children}
    </span>
  );
}

/** A person's initial in a tinted circle. */
export function Monogram({ name, tone = "navy", size = 34 }) {
  const letter = String(name || "").trim().charAt(0).toUpperCase() || "·";
  return (
    <span className={`cc-monogram tone-${tone}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {letter}
    </span>
  );
}

/**
 * A row that goes somewhere: a tile, a title over a line, a count, a
 * chevron. The whole row is the link.
 */
export function LinkRow({ to, icon, tone, title, sub, count, countQuiet, label }) {
  return (
    <Link to={to} className="cc-row" aria-label={label || (count != null ? `${title}: ${count}` : title)}>
      {icon ? <IconTile icon={icon} tone={tone} /> : null}
      <span className="cc-row-main">
        <span className="t-sub t-strong" style={{ display: "block", lineHeight: 1.3 }}>
          {title}
        </span>
        {sub ? (
          <span className="t-cap1 cc-tertiary" style={{ display: "block", lineHeight: 1.35 }}>
            {sub}
          </span>
        ) : null}
      </span>
      {count != null ? (
        countQuiet ? (
          <span className="t-sub cc-secondary" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 22, textAlign: "right" }}>
            {count}
          </span>
        ) : (
          <CountPill n={count} large />
        )
      ) : null}
      <ChevronRight size={16} strokeWidth={2.4} className="cc-chevron" aria-hidden="true" />
    </Link>
  );
}

/** One line that says a card has nothing to show, and why. */
export function EmptyLine({ icon, tone = "green", title, sub }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "8px 0 6px" }}>
      {icon ? <IconTile icon={icon} tone={tone} /> : null}
      <div className="min-w-0">
        <p className="t-sub t-strong cc-label">{title}</p>
        {sub ? <p className="t-cap1 cc-tertiary" style={{ marginTop: 2 }}>{sub}</p> : null}
      </div>
    </div>
  );
}

/** A whole screen with nothing on it yet: a floating tile over a soft gold glow. */
export function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div className="cc-empty cc-rise">
      {Icon ? (
        <div className="cc-empty-art">
          <div className="cc-empty-tile">
            <Icon size={28} strokeWidth={1.7} aria-hidden="true" />
          </div>
        </div>
      ) : null}
      <p className="t-title3 cc-label">{title}</p>
      {sub ? (
        <p className="t-sub cc-tertiary" style={{ margin: "6px auto 0", maxWidth: 300, lineHeight: 1.45 }}>
          {sub}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>{action}</div> : null}
    </div>
  );
}

/** A calm band that says what an empty-looking screen means. */
export function Notice({ icon: Icon, tone = "amber", title, children }) {
  return (
    <div className={`cc-notice tone-${tone}`}>
      {Icon ? (
        <span className="cc-notice-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={2.2} />
        </span>
      ) : null}
      <div className="min-w-0">
        {title ? <p className="t-sub t-strong cc-label">{title}</p> : null}
        <div className="t-cap1 cc-secondary" style={{ marginTop: title ? 2 : 0, lineHeight: 1.45 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The segmented control: one choice of a few, as radios. */
export function Segmented({ options, value, onChange, label, style }) {
  return (
    <div className="cc-seg" role="radiogroup" aria-label={label} style={style}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A filter chip, with an optional count. */
export function Chip({ active, onClick, children, count }) {
  return (
    <button type="button" className="cc-chip" aria-pressed={Boolean(active)} onClick={onClick}>
      {children}
      {count > 0 ? <span className="cc-count">{count}</span> : null}
    </button>
  );
}

/** The switch. */
export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      className="cc-switch"
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    />
  );
}

/**
 * A stat tile: a tile and the big number over its name, a caption on the
 * right, and its breakdown in rows under it.
 */
export function StatCard({ icon, tone, title, value, caption, rows = [], known = true, children }) {
  return (
    <div className="cc-glass" style={{ borderRadius: 16, padding: "15px 14px 10px" }}>
      <div className="flex items-center" style={{ gap: 11, marginBottom: 6 }}>
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="t-num cc-label" style={{ fontSize: 26, lineHeight: "30px" }}>
            {known ? value : "–"}
          </p>
          <h3 className="t-eyebrow cc-tertiary" style={{ marginTop: 2 }}>
            {title}
          </h3>
        </div>
        {caption ? (
          <p className="t-cap1 cc-tertiary" style={{ marginLeft: "auto", alignSelf: "flex-start", whiteSpace: "nowrap" }}>
            {caption}
          </p>
        ) : null}
      </div>
      {children}
      {known
        ? rows.map((row, i) => (
            <div key={row.label} className="flex justify-between gap-3" style={{ padding: "7px 0", boxShadow: i === 0 ? "none" : "inset 0 0.5px 0 var(--cc-hair)" }}>
              <span className="t-foot cc-secondary cc-clip">{row.label}</span>
              <span className="t-foot cc-label" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {row.value}
              </span>
            </div>
          ))
        : null}
    </div>
  );
}

/** A bottom sheet with a title, a body and a pinned footer: the phone menu. */
export function Sheet({ open, onClose, title, footer, children }) {
  const titleId = useId();
  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    const key = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", key);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="cc-scrim" onClick={onClose} aria-hidden="true" />
      <div className="cc-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel}>
        <div className="cc-sheet-grabber" aria-hidden="true" />
        <div className="cc-sheet-head">
          <h2 id={titleId} className="t-headline cc-label">
            {title}
          </h2>
          <button type="button" className="cc-icon-press" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className="cc-sheet-body">{children}</div>
        {footer ? <div className="cc-sheet-foot">{footer}</div> : null}
      </div>
    </>
  );
}

/** Skeleton blocks in the screen's real shape while the first read is in flight. */
export function Skeleton({ height = 120, style }) {
  return <div className="cc-skeleton" style={{ height, ...style }} aria-hidden="true" />;
}
