import React, { useEffect, useState } from "react";
import { Bell, Clock, Copy, CreditCard, Database, KeyRound, Mail, MessageSquare, Plug, Smartphone, Webhook } from "lucide-react";
import { Badge, Card, EmptyLine, IconTile, Notice, Page, RefreshButton } from "@/components/ui";
import { callAdmin } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useSession } from "@/lib/session";

/**
 * What is wired up and what is not, from the server's own view of its keys,
 * and the two things to copy into Stripe. Nothing secret is shown: a yes or
 * no per key, and the addresses.
 */
export default function Setup() {
  const { me } = useSession();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setHealth(await callAdmin("health"));
    } catch (failed) {
      setError(failed.status === 503 ? "The server has no database key yet (SUPABASE_SERVICE_ROLE_KEY)." : failed.status === 404 ? "The server functions aren't running here. They run on Vercel, or locally with npm run dev:api." : failed.message);
    }
    setBusy(false);
  };
  useEffect(() => {
    load();
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
      setNote("Posted a test line to #wins.");
    } catch (failed) {
      setNote(`Not posted: ${failed.body?.error || failed.message}.`);
    }
  };

  const rows = health
    ? [
        { icon: Database, tone: "navy", title: "Database", sub: "The Practice's Supabase project, with the service key", ok: health.database },
        { icon: CreditCard, tone: "plum", title: "Stripe key", sub: "Reads line items and recurring revenue", ok: health.stripe.key },
        { icon: Webhook, tone: "plum", title: "Stripe webhook secret", sub: "This app's own endpoint, below", ok: health.stripe.webhook_secret },
        { icon: Mail, tone: "green", title: "Email", sub: "Resend, for the Welcome Journey", ok: health.email },
        { icon: Bell, tone: "gold", title: "Discord #wins", sub: "A channel webhook", ok: health.discord },
        { icon: Clock, tone: "amber", title: "Hourly job", sub: health.cron.ran_at ? `Last ran ${dateTime(health.cron.ran_at)}` : "Hasn't run yet", ok: health.cron.secret },
        { icon: MessageSquare, tone: "green", title: "Text", sub: "Twilio, after the carrier registration", ok: health.sms, optional: true },
        { icon: Smartphone, tone: "navy", title: "Phone notifications", sub: "The Practice app's own push keys", ok: health.push.keys, optional: true }
      ]
    : [];
  const missing = rows.filter((row) => !row.ok && !row.optional).length;

  return (
    <Page title="Setup" subtitle={health ? (missing ? `${missing} still to connect` : "Everything is connected") : "What is connected"} right={<RefreshButton busy={busy} onClick={load} />}>
      {error ? (
        <Notice icon={Plug} title="Can't check the server">
          {error}
        </Notice>
      ) : null}

      <div className="cc-grid-2">
        <Card title="Connections" caption={health ? `${rows.length - missing - rows.filter((r) => r.optional && !r.ok).length} of ${rows.length} on` : undefined}>
          {health ? (
            <div className="cc-rows">
              {rows.map((row) => (
                <div key={row.title} className="cc-row">
                  <IconTile icon={row.icon} tone={row.tone} />
                  <div className="cc-row-main">
                    <p className="t-sub t-strong cc-label">{row.title}</p>
                    <p className="t-cap1 cc-tertiary">{row.sub}</p>
                  </div>
                  <Badge tone={row.ok ? "green" : row.optional ? "ink" : "amber"}>{row.ok ? "Connected" : row.optional ? "Optional" : "Not yet"}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine icon={Plug} tone="ink" title={busy ? "Checking…" : "Not checked yet."} />
          )}
        </Card>

        <div className="cc-stack">
          <Card title="Stripe's second endpoint">
            <p className="t-foot cc-secondary" style={{ marginBottom: 10 }}>
              In Stripe, Developers, Webhooks, Add endpoint. Use this address and these events, then put the signing secret in Vercel as STRIPE_WEBHOOK_SECRET.
            </p>
            {health ? (
              <>
                <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <code className="t-foot cc-label" style={{ fontFamily: "var(--font-mono)", wordBreak: "break-all", flex: 1 }}>
                    {health.stripe.webhook_url}
                  </code>
                  <button type="button" className="cc-btn cc-btn-quiet cc-btn-sm" onClick={() => copy(health.stripe.webhook_url)}>
                    <Copy size={13} aria-hidden="true" /> Copy
                  </button>
                </div>
                <ul className="cc-rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {health.stripe.events.map((event) => (
                    <li key={event} className="t-cap1 cc-secondary" style={{ fontFamily: "var(--font-mono)", padding: "6px 0" }}>
                      {event}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p className="t-cap1 cc-tertiary" style={{ marginTop: 8 }}>
              A holiday gift is any Stripe Payment Link whose metadata says kind = gift, and item = hat plus one year if you like. It counts the moment it is paid.
            </p>
          </Card>

          {me?.is_admin ? (
            <Card title="Try it">
              <div className="flex flex-wrap gap-2" style={{ padding: "4px 0 6px" }}>
                <button type="button" className="cc-btn cc-btn-quiet" onClick={testDiscord}>
                  <Bell size={15} aria-hidden="true" /> Post a test line to #wins
                </button>
              </div>
              <p className="t-cap1 cc-tertiary flex items-center gap-2">
                <KeyRound size={12} aria-hidden="true" /> Each journey email has its own Test on the Welcome Journey.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
      {note ? (
        <p className="t-foot cc-secondary" style={{ wordBreak: "break-all", padding: "0 4px" }}>
          {note}
        </p>
      ) : null}
    </Page>
  );
}
