import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Activity, LayoutDashboard, LogOut, Mail, Menu, Moon, Settings, Sun, Users, Volume2, VolumeX } from "lucide-react";
import { Sheet, Switch } from "@/components/ui";
import { useLive } from "@/lib/live";
import { APP_NAME, NAV_GROUPS, ORG_NAME, activeItem, badgeCount, documentTitle } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { setSoundOn, soundOn } from "@/lib/sound";
import { useTheme } from "@/lib/theme";

/*
 * The Command Center's frame, as the Detail on Demand Command Center has it.
 *
 * On a laptop (≥ 900 px): a 236 px sidebar floating as its own pane of
 * glass: the mark, "Command Center", "The Practice" and Live; the nav under
 * Overview, Members and Team with a count beside what needs someone; and a
 * one-row footer (who is signed in, sound, light or dark, Sign out). Beside
 * it, a fluid content column.
 *
 * On a phone: a frosted bar (the mark, the screen's name, Menu) whose menu
 * is a sheet with the same nav, the same switches and Sign out.
 */

export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  pulse: Activity,
  journey: Mail,
  team: Users,
  setup: Settings
};

const plainClick = (event) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function NavItem({ item, active, count, onActiveClick, onNavigate }) {
  const Icon = NAV_ICONS[item.key] || LayoutDashboard;
  return (
    <Link
      to={item.path}
      className="cc-nav-link"
      aria-current={active ? "page" : undefined}
      aria-label={count > 0 ? `${item.label}, ${count} ${item.badge.what}` : undefined}
      onClick={(event) => {
        if (!plainClick(event)) return;
        if (active) {
          event.preventDefault();
          onActiveClick?.();
          return;
        }
        onNavigate?.();
      }}
    >
      <Icon size={17} strokeWidth={2.1} aria-hidden="true" />
      <span className="cc-nav-label">{item.label}</span>
      {count > 0 ? (
        <span className="cc-count" aria-hidden="true">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function NavGroups({ prefix, active, counts, onActiveClick, onNavigate }) {
  return NAV_GROUPS.map((group) => (
    <div key={group.id} role="group" aria-labelledby={`${prefix}-${group.id}`}>
      <div id={`${prefix}-${group.id}`} className="cc-section-label">
        {group.label}
      </div>
      {group.items.map((item) => (
        <NavItem
          key={item.key}
          item={item}
          active={item.key === active.key}
          count={badgeCount(item, counts)}
          onActiveClick={onActiveClick}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  ));
}

function Brand({ live, size = 30 }) {
  return (
    <>
      <img src="/icon.svg" alt="" width={size} height={size} className="cc-mark" />
      <div style={{ minWidth: 0 }}>
        <div className="cc-label" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.2px", lineHeight: "18px" }}>
          {APP_NAME}
        </div>
        <div className="cc-tertiary flex items-center" style={{ fontSize: 12, lineHeight: "15px", gap: 7 }}>
          <span>{ORG_NAME}</span>
          {live ? (
            <span className="cc-live" title="Live: new members, orders and upgrades appear as they happen">
              <span className="cc-live-dot" aria-hidden="true" />
              Live
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}

const scrollTop = () => window.scrollTo?.({ top: 0, left: 0, behavior: "smooth" });

export default function Shell() {
  const { me, user, signOut } = useSession();
  const { live, counts } = useLive();
  const { dark, toggle } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sound, setSound] = useState(soundOn());
  const mainRef = useRef(null);
  const active = activeItem(location.pathname);
  const email = me?.email || user?.email || "";

  // The browser tab names the screen.
  useEffect(() => {
    document.title = documentTitle(active);
  }, [active]);

  // Each screen starts at the top and takes focus, so the next Tab lands in
  // it and a screen reader hears the new title; not on the first render.
  const mounted = useRef(false);
  useEffect(() => {
    window.scrollTo?.({ top: 0, left: 0 });
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    try {
      mainRef.current?.focus({ preventScroll: true });
    } catch {
      // Focus is a courtesy.
    }
  }, [active.key]);

  const toggleSound = () => {
    setSoundOn(!sound);
    setSound(!sound);
  };
  const closeMenu = () => setMenuOpen(false);
  const ThemeIcon = dark ? Sun : Moon;
  const SoundIcon = sound ? Volume2 : VolumeX;

  return (
    <div className="cc-shell">
      <a className="cc-skip" href="#cc-main">
        Skip to content
      </a>

      <aside className="cc-sidebar cc-glass">
        <div className="cc-brand">
          <Brand live={live} />
        </div>
        <nav className="cc-nav" aria-label={APP_NAME}>
          <NavGroups prefix="cc-side" active={active} counts={counts} onActiveClick={scrollTop} />
        </nav>
        <div className="cc-sidebar-footer">
          <div className="cc-account" title={email}>
            {me?.name || email}
          </div>
          <button type="button" className="cc-icon-button" role="switch" aria-checked={sound} aria-label="Sound" title={sound ? "Sound is on" : "Sound is off"} onClick={toggleSound}>
            <SoundIcon size={16} strokeWidth={2.1} aria-hidden="true" />
          </button>
          <button type="button" className="cc-icon-button" role="switch" aria-checked={dark} aria-label="Dark mode" title={dark ? "Dark mode is on" : "Dark mode is off"} onClick={toggle}>
            <ThemeIcon size={16} strokeWidth={2.1} aria-hidden="true" />
          </button>
          <button type="button" className="cc-nav-link cc-signout" onClick={signOut}>
            <LogOut size={15} strokeWidth={2.1} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <header className="cc-topbar">
        <img src="/icon.svg" alt="" width={30} height={30} className="cc-mark" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-eyebrow cc-tertiary flex items-center gap-2">
            {APP_NAME}
            {live ? (
              <span className="cc-live" style={{ textTransform: "none", letterSpacing: 0 }}>
                <span className="cc-live-dot" aria-hidden="true" />
                Live
              </span>
            ) : null}
          </div>
          <div className="cc-label cc-clip" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.2px", lineHeight: "20px" }}>
            {active.label}
          </div>
        </div>
        <button type="button" className="cc-menu-button" aria-label="Menu" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <Menu size={24} strokeWidth={2.1} aria-hidden="true" />
          {counts.needsYou > 0 ? <span className="sr-only">, {counts.needsYou} need you</span> : null}
        </button>
      </header>

      <main id="cc-main" ref={mainRef} tabIndex={-1} className="cc-main">
        <div className="cc-content">
          <Outlet />
        </div>
      </main>

      <Sheet
        open={menuOpen}
        onClose={closeMenu}
        title={APP_NAME}
        footer={
          <div className="cc-menu-footer">
            <div className="cc-nav-row">
              <Moon size={17} strokeWidth={2.1} aria-hidden="true" />
              <span className="cc-nav-label">Dark mode</span>
              <Switch checked={dark} onChange={toggle} label="Dark mode" />
            </div>
            <div className="cc-nav-row">
              <Volume2 size={17} strokeWidth={2.1} aria-hidden="true" />
              <span className="cc-nav-label">Sound for big moments</span>
              <Switch checked={sound} onChange={toggleSound} label="Sound" />
            </div>
            <div className="flex items-center gap-3" style={{ marginTop: 6 }}>
              <div className="t-foot cc-tertiary cc-clip" style={{ flex: 1, minWidth: 0 }} title={email}>
                {email}
              </div>
              <button type="button" className="cc-btn cc-btn-quiet" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        }
      >
        <nav className="cc-menu" aria-label={APP_NAME}>
          <NavGroups
            prefix="cc-menu"
            active={active}
            counts={counts}
            onNavigate={closeMenu}
            onActiveClick={() => {
              closeMenu();
              scrollTop();
            }}
          />
        </nav>
      </Sheet>
    </div>
  );
}
