import React, { useState } from "react";
import { ShieldOff } from "lucide-react";
import { Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase";

/*
 * The team's sign-in, laid out as the Detail on Demand Command Center's:
 * one frosted card with the mark, Google, an "or", email and password, and
 * a sign-in link by email. The same accounts as the Practice app; whether
 * an account may enter is the team list's call (cc_team), and the database
 * refuses everyone else whatever this page shows.
 */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy("email");
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy("");
    if (error) setMsg({ kind: "error", text: error.message });
  };

  const link = async () => {
    if (busy) return;
    if (!email.trim()) return setMsg({ kind: "error", text: "Your email first, then the link." });
    setBusy("link");
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin, shouldCreateUser: false } });
    setBusy("");
    setMsg(error ? { kind: "error", text: error.message } : { kind: "notice", text: "Check your inbox for the sign-in link." });
  };

  const google = async () => {
    if (busy) return;
    setBusy("google");
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) {
      setBusy("");
      setMsg({ kind: "error", text: error.message });
    }
  };

  return (
    <div className="cc-login">
      <div className="cc-login-card cc-glass cc-rise">
        <img className="cc-login-mark" src="/icon.svg" alt="The Practice" width={64} height={64} />
        <h1 className="t-title3 cc-label" style={{ textAlign: "center", marginTop: 18, fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 26, lineHeight: "32px" }}>
          Command Center
        </h1>
        <p className="t-sub cc-tertiary" style={{ textAlign: "center", margin: "6px 0 22px" }}>
          The Practice team.
        </p>

        <button type="button" className="cc-btn cc-btn-quiet" style={{ width: "100%", height: 48 }} onClick={google} disabled={Boolean(busy)}>
          {busy === "google" ? (
            <Spinner size={18} label="Signing in" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <div className="cc-or">or</div>

        <form onSubmit={submit} noValidate className="flex flex-col" style={{ gap: 10 }}>
          <div>
            <label className="cc-field-label" htmlFor="cc-email">
              Email
            </label>
            <input id="cc-email" className="cc-input" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="cc-field-label" htmlFor="cc-password">
              Password
            </label>
            <input id="cc-password" className="cc-input" type="password" autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg ? (
            <p className="t-foot" role={msg.kind === "error" ? "alert" : "status"} style={{ color: msg.kind === "error" ? "var(--cc-alert)" : "var(--cc-secondary)" }}>
              {msg.text}
            </p>
          ) : null}
          <button type="submit" className="cc-btn cc-btn-primary" style={{ height: 48, marginTop: 2 }} disabled={Boolean(busy)}>
            {busy === "email" ? <Spinner size={18} label="Signing in" /> : "Sign in"}
          </button>
          <button type="button" className="cc-link-button" style={{ alignSelf: "flex-end" }} onClick={link} disabled={Boolean(busy)}>
            {busy === "link" ? "Sending a link…" : "Email me a sign-in link"}
          </button>
        </form>

        <p className="t-cap1 cc-tertiary" style={{ textAlign: "center", marginTop: 14, lineHeight: 1.45 }}>
          Team sign-in only, with the account you use for the Practice.
        </p>
      </div>
    </div>
  );
}

/** Signed in, and not on the team: say so, and offer the way out. */
export function NotOnTeam({ email, onSignOut }) {
  return (
    <div className="cc-login">
      <div className="cc-login-card cc-glass cc-rise" style={{ textAlign: "center" }}>
        <span className="cc-tile tone-rust" style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto" }} aria-hidden="true">
          <ShieldOff size={28} strokeWidth={2} />
        </span>
        <h1 className="t-title3 cc-label" style={{ marginTop: 16 }}>
          This account isn't on the team yet
        </h1>
        <p className="t-sub cc-tertiary" style={{ margin: "8px auto 20px", maxWidth: 320, lineHeight: 1.45 }}>
          {email} is signed in, but only people on the team list can use the Command Center. Ask Leah or Logan to add it, then sign in again.
        </p>
        <button type="button" className="cc-btn cc-btn-primary" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
