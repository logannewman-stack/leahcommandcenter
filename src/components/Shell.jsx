import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Activity, Home, LogOut, Mail, Settings, Volume2, VolumeX } from "lucide-react";
import Mark from "@/components/Mark";
import { useSession } from "@/lib/session";
import { setSoundOn, soundOn } from "@/lib/sound";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/pulse", label: "Live Pulse", icon: Activity },
  { to: "/journey", label: "Welcome Journey", icon: Mail },
  { to: "/setup", label: "Setup", icon: Settings }
];

/** The frame every screen sits in: the mark, the four places to go, who is signed in. */
export default function Shell() {
  const { me, signOut } = useSession();
  const [sound, setSound] = useState(soundOn());
  const toggleSound = () => {
    setSoundOn(!sound);
    setSound(!sound);
  };
  const link = ({ isActive }) =>
    `flex items-center gap-2 rounded-field px-3 py-2 text-[14px] font-semibold transition-colors ${
      isActive ? "bg-accent text-accent-ink" : "text-ink-muted hover:bg-canvas-sunken hover:text-ink"
    }`;
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Mark size={34} />
            <div className="leading-tight min-w-0">
              <p className="eyebrow">The Practice</p>
              <h1 className="font-display text-[19px] text-ink truncate">Command Center</h1>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={link}>
                <Icon size={16} strokeWidth={1.75} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn-quiet !px-2.5 !py-2" onClick={toggleSound} aria-pressed={sound} title={sound ? "Sound on" : "Sound off"}>
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="sr-only">{sound ? "Turn sound off" : "Turn sound on"}</span>
            </button>
            <span className="hidden sm:block text-sm text-ink-muted">{me?.name}</span>
            <button type="button" className="btn-quiet !px-2.5 !py-2" onClick={signOut} title="Sign out">
              <LogOut size={16} />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        </div>
        <nav className="md:hidden border-t border-line px-2 py-1.5 flex gap-1 overflow-x-auto" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={link}>
              <Icon size={16} strokeWidth={1.75} /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-ink-faint">
        First name and city only on the board and in Discord. Contact details stay in the admin view.
      </footer>
    </div>
  );
}
