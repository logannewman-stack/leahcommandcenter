import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, Mail, MessageSquare, PauseCircle, Send, Smartphone } from "lucide-react";
import { Badge, Card, Chip, EmptyLine, IconTile, Monogram, Notice, Page, RefreshButton, Switch } from "@/components/ui";
import { callAdmin } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { updatedLabel, useTick } from "@/lib/live";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { STEPS, stepIsOn } from "@/lib/words";

const WHEN = (step) => {
  if (step.on === "upgrade") return "On becoming a member";
  if (step.on === "merch") return "On a merch order";
  if (step.on === "quiet") return "After a quiet week";
  if (step.id === "day6_trial") return "Day before trial ends";
  return step.after === 0 ? "Right after sign up" : `Day ${step.after}`;
};
const CHANNEL = { email: "Email", sms: "Text", push: "In app" };
const CHANNEL_ICON = { email: Mail, sms: MessageSquare, push: Smartphone };
const STATUS = {
  sent: { label: "Sent", tone: "green" },
  due: { label: "Due", tone: "amber" },
  skipped: { label: "Skipped", tone: "ink" },
  failed: { label: "Didn't send", tone: "rust" }
};
const FILTERS = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "due", label: "Due" },
  { id: "skipped", label: "Skipped" },
  { id: "failed", label: "Didn't send" }
];
const NOTES = {
  waiting_on_copy: "waiting on Leah's copy",
  waiting_on_leah: "waiting on Leah's OK",
  not_on_trial: "not on a trial",
  texting_off: "texting is off",
  no_opt_in: "no text opt-in",
  no_longer_member: "no longer a member",
  already_a_member: "already a member",
  journey_off: "the journey was off",
  no_address: "no email address",
  no_email_provider: "email isn't set up",
  no_sms_provider: "text isn't set up",
  no_devices: "no phone with notifications on",
  no_push_keys: "no push keys",
  no_account: "no account"
};
const noteOf = (note) => (note ? NOTES[note] || note.replace(/_/g, " ") : "");

/**
 * The Welcome Journey: the series as it stands, the switches, and every
 * message planned or sent, with why one was skipped.
 */
export default function Journey() {
  const { me, settings, refresh: refreshSession } = useSession();
  const [params, setParams] = useSearchParams();
  const status = FILTERS.some((f) => f.id === params.get("status")) ? params.get("status") : "all";
  useTick(30_000);
  const [rows, setRows] = useState([]);
  const [at, setAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [weekSent, setWeekSent] = useState(null);

  const load = useCallback(async () => {
    let query = supabase.from("cc_journey").select("*").order("due_at", { ascending: false }).limit(80);
    if (status !== "all") query = query.eq("status", status);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data }, week] = await Promise.all([query, supabase.from("cc_journey").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", weekAgo)]);
    setRows(data || []);
    setWeekSent(week.error ? null : Number(week.count) || 0);
    setAt(Date.now());
    setLoading(false);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = (id) => {
    const next = new URLSearchParams(params);
    if (id === "all") next.delete("status");
    else next.set("status", id);
    setParams(next, { replace: true });
  };

  const refresh = async () => {
    setSpinning(true);
    await load();
    setTimeout(() => setSpinning(false), 500);
  };

  const test = async (step) => {
    setBusy(step);
    setNote("");
    try {
      const result = await callAdmin("test", { method: "POST", body: { step } });
      setNote(result.sent ? `Sent "${result.preview.subject}" to ${result.to}.` : `Not sent: ${result.error}.`);
    } catch (error) {
      setNote(error.body?.error === "no_email_provider" ? "Email isn't set up yet (RESEND_API_KEY on the server)." : `Not sent: ${error.body?.error || error.message}.`);
    }
    setBusy("");
  };

  const setSetting = async (patch) => {
    setNote("");
    const { error } = await supabase.from("cc_settings").update(patch).eq("id", true);
    if (error) setNote(error.message);
    else refreshSession();
  };

  // A draft in Leah's voice, turned on (or off) once she has read it.
  const approve = (id, on) => {
    const now = Array.isArray(settings?.journey_approved) ? settings.journey_approved : [];
    return setSetting({ journey_approved: on ? [...new Set([...now, id])] : now.filter((x) => x !== id) });
  };

  const subtitle = [weekSent == null ? "" : `${weekSent} sent this week`, updatedLabel(at)].filter(Boolean).join(" · ");
  const admin = Boolean(me?.is_admin);

  return (
    <Page title="Welcome Journey" subtitle={subtitle || "Emails, texts and what went out"} right={<RefreshButton busy={spinning} onClick={refresh} />}>
      {settings && !settings.journey_enabled ? (
        <Notice icon={PauseCircle} tone="amber" title="The Welcome Journey is off">
          Steps still get planned as members join, and each is skipped with that reason until it is turned back on below.
        </Notice>
      ) : null}

      <div className="cc-grid-2">
        <Card title="The series" caption={`${STEPS.filter((s) => stepIsOn(s, settings || {})).length} of ${STEPS.length} on`}>
          <div className="cc-rows">
            {STEPS.map((step) => {
              const Icon = CHANNEL_ICON[step.channels[0]] || Mail;
              const on = stepIsOn(step, settings || {});
              return (
                <div key={step.id} className="cc-row">
                  <IconTile icon={Icon} tone={on ? "navy" : "plum"} />
                  <div className="cc-row-main">
                    <p className="t-sub t-strong cc-label" style={{ lineHeight: 1.3 }}>
                      {step.label}
                    </p>
                    <p className="t-cap1 cc-tertiary">
                      {WHEN(step)} · {step.channels.map((c) => CHANNEL[c]).join(" + ")}
                      {step.draft ? (on ? " · Leah's OK'd" : " · Draft, waiting on Leah's OK") : ""}
                    </p>
                  </div>
                  {step.draft ? (
                    <span className="flex items-center" style={{ gap: 8 }}>
                      <button type="button" className="cc-btn cc-btn-quiet cc-btn-sm" onClick={() => test(step.id)} disabled={busy === step.id} title="Sends this email to your own inbox to read">
                        <Send size={13} aria-hidden="true" /> Test
                      </button>
                      <Switch checked={on} disabled={!admin} onChange={(next) => approve(step.id, next)} label={`Send "${step.label}"`} />
                    </span>
                  ) : step.enabled ? (
                    step.channels.includes("email") ? (
                      <button type="button" className="cc-btn cc-btn-quiet cc-btn-sm" onClick={() => test(step.id)} disabled={busy === step.id} title="Sends this email to your own inbox">
                        <Send size={13} aria-hidden="true" /> Test
                      </button>
                    ) : (
                      <Badge tone="green">On</Badge>
                    )
                  ) : (
                    <Badge tone="plum">Waiting on copy</Badge>
                  )}
                </div>
              );
            })}
          </div>
          {note ? (
            <p className="t-foot cc-secondary" style={{ padding: "8px 0 4px" }}>
              {note}
            </p>
          ) : null}
          <p className="t-cap1 cc-tertiary" style={{ padding: "8px 0 4px" }}>
            The words live in one file, api/_lib/words.js. A draft goes out only once it's switched on here: tap Test to read it in your inbox first.
          </p>
        </Card>

        <div className="cc-stack">
          <Card title="Switches" caption={admin ? undefined : "Admins change these"}>
            <div className="cc-rows">
              <SwitchRow icon={Mail} tone="navy" title="Welcome Journey" sub="Send each step as it comes due" checked={settings?.journey_enabled} disabled={!admin} onChange={(on) => setSetting({ journey_enabled: on })} />
              <SwitchRow icon={Bell} tone="gold" title="Post wins to Discord" sub="New members, upgrades, orders, gifts" checked={settings?.discord_wins_enabled} disabled={!admin} onChange={(on) => setSetting({ discord_wins_enabled: on })} />
              <SwitchRow
                icon={MessageSquare}
                tone="green"
                title="Texting"
                sub="After the carrier registration and the sign-up opt-in"
                checked={settings?.texting_enabled}
                disabled={!admin}
                onChange={(on) => setSetting({ texting_enabled: on })}
              />
              <div className="cc-row">
                <IconTile icon={Send} tone="plum" />
                <div className="cc-row-main">
                  <p className="t-sub t-strong cc-label">Messages come from</p>
                  <p className="t-cap1 cc-tertiary">The sender name and the sign-off</p>
                </div>
                <select className="cc-input" style={{ width: "auto", height: 36, fontSize: 14 }} value={settings?.sender || "Leah"} disabled={!admin} onChange={(e) => setSetting({ sender: e.target.value })} aria-label="Messages come from">
                  <option value="Leah">Leah</option>
                  <option value="The Practice">The Practice</option>
                </select>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between" style={{ gap: 8, padding: "6px 2px 0" }}>
        <h2 className="t-headline cc-label">Messages</h2>
      </div>
      <nav className="cc-chips" aria-label="Show">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={f.id === status} onClick={() => choose(f.id)}>
            {f.label}
          </Chip>
        ))}
      </nav>
      <Card flush>
        {loading ? (
          <p className="t-foot cc-tertiary" style={{ padding: 16 }}>
            Loading…
          </p>
        ) : rows.length ? (
          <div className="cc-rows" style={{ padding: "0 8px" }}>
            {rows.map((row) => {
              const step = STEPS.find((s) => s.id === row.step);
              const state = STATUS[row.status] || STATUS.due;
              return (
                <div key={row.id} className="cc-row">
                  <Monogram name={row.first_name} tone="navy" />
                  <div className="cc-row-main">
                    <p className="t-sub t-strong cc-label cc-clip">
                      {row.first_name || "A member"} · {step?.label || row.step}
                    </p>
                    <p className="t-cap1 cc-tertiary cc-clip">
                      {CHANNEL[row.channel] || row.channel} · {row.status === "sent" && row.sent_at ? `sent ${dateTime(row.sent_at)}` : `due ${dateTime(row.due_at)}`}
                      {row.note && row.status !== "sent" ? ` · ${noteOf(row.note)}` : ""}
                    </p>
                  </div>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "4px 16px" }}>
            <EmptyLine icon={Mail} tone="navy" title={status === "all" ? "No messages planned yet." : "Nothing here."} sub="The first member to join plans the whole series." />
          </div>
        )}
      </Card>
    </Page>
  );
}

function SwitchRow({ icon, tone, title, sub, checked, onChange, disabled }) {
  return (
    <div className="cc-row">
      <IconTile icon={icon} tone={tone} />
      <div className="cc-row-main">
        <p className="t-sub t-strong cc-label">{title}</p>
        <p className="t-cap1 cc-tertiary">{sub}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}
