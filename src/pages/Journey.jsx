import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { callAdmin } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { STEPS } from "@/lib/words";

const WHEN = (step) => {
  if (step.on === "upgrade") return "On upgrade";
  if (step.on === "merch") return "On a merch order";
  if (step.on === "quiet") return "Quiet for 10 days";
  return step.after === 0 ? "Right after sign up" : `Day ${step.after}`;
};
const CHANNEL = { email: "Email", sms: "Text", push: "In app" };
const STATUS = { due: "Due", sent: "Sent", skipped: "Skipped", failed: "Failed" };

/**
 * The Welcome Journey: the series as it stands, what has gone out, the
 * switches, and a way to see each email in your own inbox first.
 */
export default function Journey() {
  const { me, settings, refresh } = useSession();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    const { data } = await supabase.from("cc_journey").select("*").order("due_at", { ascending: false }).limit(60);
    setRows(data || []);
  };
  useEffect(() => {
    load();
  }, []);

  const test = async (step) => {
    setBusy(step);
    setNote("");
    try {
      const result = await callAdmin("test", { method: "POST", body: { step } });
      setNote(result.sent ? `Sent "${result.preview.subject}" to ${result.to}.` : `Not sent: ${result.error}.`);
    } catch (error) {
      setNote(error.body?.error === "no_email_provider" ? "Email isn't set up yet (RESEND_API_KEY)." : `Not sent: ${error.body?.error || error.message}.`);
    }
    setBusy("");
  };

  const setSetting = async (patch) => {
    const { error } = await supabase.from("cc_settings").update(patch).eq("id", true);
    if (error) setNote(error.message);
    else refresh();
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl">The series</h2>
        <div className="card divide-y divide-line">
          {STEPS.map((step) => (
            <div key={step.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="w-40 shrink-0 text-xs text-ink-faint">{WHEN(step)}</span>
              <span className="w-24 shrink-0 text-xs text-ink-faint">{step.channels.map((c) => CHANNEL[c]).join(" + ")}</span>
              <span className="flex-1 min-w-[12rem] text-[15px]">{step.label}</span>
              {step.enabled ? (
                step.channels.includes("email") ? (
                  <button type="button" className="btn-quiet !py-1 !px-2.5 text-xs" onClick={() => test(step.id)} disabled={busy === step.id}>
                    <Send size={13} /> Send me a test
                  </button>
                ) : (
                  <span className="text-xs text-ink-faint">Sent in the app</span>
                )
              ) : (
                <span className="text-xs rounded-full border border-line-strong px-2 py-0.5 text-ink-faint">Waiting on Leah's copy</span>
              )}
            </div>
          ))}
        </div>
        {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
        <p className="text-xs text-ink-faint">
          Copy lives in one file, api/_lib/words.js. A step without Leah's approved words is planned but never sent.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Switches</h2>
        <div className="card p-4 grid gap-3 sm:grid-cols-2">
          <Switch label="Welcome Journey on" on={settings?.journey_enabled} admin={me?.is_admin} onChange={(on) => setSetting({ journey_enabled: on })} />
          <Switch label="Post wins to Discord" on={settings?.discord_wins_enabled} admin={me?.is_admin} onChange={(on) => setSetting({ discord_wins_enabled: on })} />
          <Switch
            label="Texting on (after carrier registration)"
            on={settings?.texting_enabled}
            admin={me?.is_admin}
            onChange={(on) => setSetting({ texting_enabled: on })}
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Messages come from</span>
            <select
              className="field !w-auto"
              value={settings?.sender || "Leah"}
              disabled={!me?.is_admin}
              onChange={(e) => setSetting({ sender: e.target.value })}
            >
              <option value="Leah">Leah personally</option>
              <option value="The Practice">The Practice</option>
            </select>
          </label>
        </div>
        {!me?.is_admin ? <p className="text-xs text-ink-faint">Admins change the switches.</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Recent sends</h2>
        {rows.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-faint">
                  <th className="px-4 py-2 font-semibold">Who</th>
                  <th className="px-4 py-2 font-semibold">Step</th>
                  <th className="px-4 py-2 font-semibold">How</th>
                  <th className="px-4 py-2 font-semibold">Due</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2">{row.first_name || "A member"}</td>
                    <td className="px-4 py-2">{STEPS.find((s) => s.id === row.step)?.label || row.step}</td>
                    <td className="px-4 py-2">{CHANNEL[row.channel] || row.channel}</td>
                    <td className="px-4 py-2 text-ink-muted">{dateTime(row.due_at)}</td>
                    <td className="px-4 py-2">
                      <span className={row.status === "failed" ? "text-danger" : row.status === "sent" ? "text-positive" : "text-ink-muted"}>{STATUS[row.status] || row.status}</span>
                      {row.note ? <span className="ml-1 text-xs text-ink-faint">({row.note.replace(/_/g, " ")})</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="card p-6 text-sm text-ink-muted">No messages planned yet. The first join plans the series.</p>
        )}
      </section>
    </div>
  );
}

function Switch({ label, on, admin, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--accent))]" checked={Boolean(on)} disabled={!admin} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
