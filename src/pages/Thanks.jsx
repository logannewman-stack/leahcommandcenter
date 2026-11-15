import React, { useMemo, useState } from "react";
import { Award, HeartHandshake, Quote, Send, Undo2 } from "lucide-react";
import { Card, EmptyState, IconTile, Monogram, Page } from "@/components/ui";
import { useLive } from "@/lib/live";
import { useSession } from "@/lib/session";
import { useTasks } from "@/lib/tasksStore";
import { useShoutouts } from "@/lib/teamData";
import { useToast } from "@/lib/toast";
import { timeAgo } from "@/lib/format";

const weekStart = (at = new Date()) => {
  const d = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
};
const quarterStart = (at = new Date()) => new Date(at.getFullYear(), Math.floor(at.getMonth() / 3) * 3, 1);

/**
 * The Gratitude Wall: teammates thank each other for something specific, the
 * week's count, and the quarter's most thanked. Each thank you lands on
 * everyone's wall the moment it is sent.
 */
export default function Thanks() {
  const { me } = useSession();
  const { people, personOf } = useTasks();
  const { rows, loading, thank, takeBack } = useShoutouts(200);
  const { celebrate } = useLive();
  const { toast } = useToast();
  const others = people.filter((p) => p.email !== me?.email);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const week = weekStart();
  const quarter = quarterStart();
  const thisWeek = rows.filter((r) => new Date(r.created_at) >= week);
  const leaders = useMemo(() => {
    const counts = {};
    for (const r of rows) if (new Date(r.created_at) >= quarter) counts[r.to_email] = (counts[r.to_email] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    // quarter is a new Date each render; the rows are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const q = Math.floor(new Date().getMonth() / 3) + 1;

  const send = async (event) => {
    event.preventDefault();
    if (!to) return toast({ title: "Who is it for?", tone: "amber" });
    if (!message.trim()) return toast({ title: "Say what for", body: "Specific is the whole point.", tone: "amber" });
    setBusy(true);
    const failed = await thank({ to, message });
    setBusy(false);
    if (failed) return toast({ title: "That didn't send", body: failed, tone: "rust" });
    setMessage("");
    celebrate(false);
    toast({ title: `Thanks sent to ${personOf(to).name}`, body: "It's on the wall for the whole team.", icon: HeartHandshake, tone: "gold" });
  };

  const undo = async (id) => {
    const failed = await takeBack(id);
    if (failed) toast({ title: "That didn't come off", body: failed, tone: "rust" });
  };

  return (
    <Page title="Gratitude Wall" subtitle={`${thisWeek.length} thank ${thisWeek.length === 1 ? "you" : "yous"} this week · for something specific`}>
      <div className="cc-grid-2">
        <Card title="Thank a teammate">
          <form onSubmit={send} className="flex flex-col" style={{ gap: 12, paddingBottom: 6 }}>
            <div className="cc-chips" role="radiogroup" aria-label="Who">
              {others.map((p) => (
                <button key={p.email} type="button" role="radio" aria-checked={to === p.email} className="cc-chip cc-chip-sm" onClick={() => setTo(p.email)}>
                  <Monogram name={p.name} tone={p.tone} size={20} /> {p.name}
                </button>
              ))}
            </div>
            <textarea
              className="cc-input cc-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={280}
              placeholder="Thank you for answering every member question this week."
              aria-label="What for"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="t-cap1 cc-tertiary">It lands on everyone's wall the moment you send it.</span>
              <button type="submit" className="cc-btn cc-btn-primary" disabled={busy}>
                <Send size={15} /> Send the thanks
              </button>
            </div>
          </form>
        </Card>
        <Card title={`Q${q} recognition`} caption="Most thanked">
          {leaders.length ? (
            <div className="cc-rows">
              {leaders.map(([email, n], i) => {
                const person = personOf(email);
                return (
                  <div key={email} className="cc-row" style={{ minHeight: 50 }}>
                    <span className="t-num cc-label" style={{ width: 18, fontSize: 18, color: i === 0 ? "var(--cc-gold, #B08D57)" : undefined }}>
                      {i + 1}
                    </span>
                    <Monogram name={person.name} tone={person.tone} size={32} />
                    <span className="cc-row-main t-sub t-strong cc-label">{person.name}</span>
                    <span className="t-foot cc-secondary">
                      {n} thank {n === 1 ? "you" : "yous"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3" style={{ padding: "8px 0" }}>
              <IconTile icon={Award} tone="gold" />
              <p className="t-foot cc-secondary">The quarter's first thank you puts someone at the top.</p>
            </div>
          )}
        </Card>
      </div>

      {loading ? null : rows.length ? (
        <div className="cc-grid-3">
          {rows.map((row) => {
            const from = personOf(row.from_email);
            const toPerson = personOf(row.to_email);
            const mine = row.from_email === me?.email;
            return (
              <section key={row.id} className="cc-glass cc-card cc-rise" aria-label={`${from.name} thanked ${toPerson.name}`}>
                <Quote size={18} style={{ color: "var(--cc-gold, #B08D57)" }} aria-hidden="true" />
                <p style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.4, margin: "8px 0 14px" }} className="cc-label">
                  {row.message}
                </p>
                <div className="flex items-center gap-2.5">
                  <Monogram name={from.name} tone={from.tone} size={26} />
                  <p className="t-cap1 cc-secondary min-w-0" style={{ flex: 1 }}>
                    <span className="t-strong cc-label">{from.name}</span> to <span className="t-strong cc-label">{toPerson.name}</span>
                    <span className="cc-tertiary"> · {timeAgo(row.created_at)}</span>
                  </p>
                  {mine || me?.is_admin ? (
                    <button type="button" className="cc-icon-press" onClick={() => undo(row.id)} aria-label="Take it back" title="Take it back">
                      <Undo2 size={15} />
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={HeartHandshake}
            title="The wall is waiting for its first thank you"
            sub={'Name the person and the thing. "Thank you for covering the refund emails" lands better than "great job".'}
          />
        </Card>
      )}
    </Page>
  );
}
