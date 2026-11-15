import React, { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { callAdmin } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useSession } from "@/lib/session";

/**
 * What is wired up and what is not, from the server's own view of its keys,
 * and the two things to copy into Stripe. Nothing secret is shown: a yes or
 * no per key, and the addresses.
 */
export default function Setup() {
  const { me, team } = useSession();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    callAdmin("health")
      .then(setHealth)
      .catch((failed) => setError(failed.status === 503 ? "The server has no database key yet (SUPABASE_SERVICE_ROLE_KEY)." : failed.message));
  }, []);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Copied.");
    } catch {
      setNote(text);
    }
  };

  const testDiscord = async () => {
    setNote("");
    try {
      await callAdmin("discord", { method: "POST" });
      setNote("Posted to #wins.");
    } catch (failed) {
      setNote(`Not posted: ${failed.body?.error || failed.message}.`);
    }
  };

  const rows = health
    ? [
        ["Database (service key)", health.database],
        ["Stripe secret key", health.stripe.key],
        ["Stripe webhook secret", health.stripe.webhook_secret],
        ["Email (Resend)", health.email],
        ["Text (Twilio)", health.sms],
        ["Discord #wins webhook", health.discord],
        ["Phone notifications (the Practice's push keys)", health.push.keys],
        ["Hourly job secret", health.cron.secret]
      ]
    : [];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl">Connected</h2>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {health ? (
          <div className="card divide-y divide-line">
            {rows.map(([label, ok]) => (
              <div key={label} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className={`flex items-center gap-1 text-xs ${ok ? "text-positive" : "text-ink-faint"}`}>
                  {ok ? <Check size={14} /> : <X size={14} />} {ok ? "yes" : "not yet"}
                </span>
              </div>
            ))}
            <div className="px-4 py-2.5 flex items-center justify-between text-sm">
              <span>Hourly job last ran</span>
              <span className="text-xs text-ink-muted">{health.cron.ran_at ? dateTime(health.cron.ran_at) : "never"}</span>
            </div>
          </div>
        ) : !error ? (
          <p className="text-sm text-ink-faint">Checking…</p>
        ) : null}
      </section>

      {health ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Stripe's second endpoint</h2>
          <p className="text-sm text-ink-muted">
            In Stripe, Developers → Webhooks → Add endpoint. The address and the events below; then the signing secret goes in Vercel as
            STRIPE_WEBHOOK_SECRET.
          </p>
          <div className="card p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <code className="font-mono text-[13px] break-all">{health.stripe.webhook_url}</code>
              <button type="button" className="btn-quiet !py-1 !px-2" onClick={() => copy(health.stripe.webhook_url)}>
                <Copy size={13} />
              </button>
            </div>
            <ul className="text-xs text-ink-muted font-mono">
              {health.stripe.events.map((event) => (
                <li key={event}>{event}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ink-faint">
            A gift subscription is any Stripe Payment Link whose metadata says kind = gift (and, if you like, item = hat plus one year). It counts the moment it is paid.
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl">The team</h2>
        <div className="card divide-y divide-line">
          {team.map((person) => (
            <div key={person.email} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="w-28 font-semibold">{person.name}</span>
              <span className="w-32 text-ink-muted">{person.lane || "–"}</span>
              <span className="flex-1 text-xs text-ink-faint">{(person.responsibilities || []).join(" · ")}</span>
              {person.is_admin ? <span className="text-xs rounded-full border border-line-strong px-2 py-0.5">admin</span> : null}
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-faint">Roles and responsibilities get their own page with the Team Board in Phase 2. For now the list is edited in Supabase (supabase/seed-team.sql).</p>
      </section>

      {me?.is_admin ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Try it</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-quiet" onClick={testDiscord}>
              Post a test line to #wins
            </button>
          </div>
        </section>
      ) : null}
      {note ? <p className="text-sm text-ink-muted break-all">{note}</p> : null}
    </div>
  );
}
