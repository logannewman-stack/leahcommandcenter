import React, { useState } from "react";
import { LogIn, Mail } from "lucide-react";
import Mark from "@/components/Mark";
import { supabase } from "@/lib/supabase";

/**
 * The team signs in with the account they use for the Practice: a password,
 * a link by email, or Google (when the Practice's project has it on, and
 * this app's address is in its redirect list; see README).
 */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const withPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNote("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setNote(error.message);
  };

  const withLink = async () => {
    if (!email.trim()) return setNote("Your email first.");
    setBusy(true);
    setNote("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    setNote(error ? error.message : "Check your inbox for the link.");
  };

  const withGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) {
      setBusy(false);
      setNote(error.message);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <form onSubmit={withPassword} className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Mark size={40} />
          <div>
            <p className="eyebrow">The Practice</p>
            <h1 className="font-display text-2xl">Command Center</h1>
          </div>
        </div>
        <p className="text-sm text-ink-muted">Sign in with the account you use for the Practice.</p>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Email</span>
          <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Password</span>
          <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          <LogIn size={16} /> Sign in
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn-quiet flex-1" onClick={withLink} disabled={busy}>
            <Mail size={16} /> Email me a link
          </button>
          <button type="button" className="btn-quiet flex-1" onClick={withGoogle} disabled={busy}>
            Google
          </button>
        </div>
        {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
      </form>
    </div>
  );
}

/** Signed in, and not on the team: nothing to see, and a way out. */
export function NotOnTeam({ email, onSignOut }) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Mark size={40} />
          <h1 className="font-display text-2xl">Not on the team yet</h1>
        </div>
        <p className="text-sm text-ink-muted">
          {email} is signed in, but it isn't on the team list. Ask Leah or Logan to add it, then sign in again.
        </p>
        <button type="button" className="btn-quiet w-full" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
