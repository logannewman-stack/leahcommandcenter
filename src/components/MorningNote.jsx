import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarHeart, ChevronRight, PenLine, Sun, Trophy } from "lucide-react";
import { Card, IconTile, Monogram, Sheet } from "@/components/ui";
import { MILESTONES, nextStep } from "@/lib/goals";
import { useSession } from "@/lib/session";
import { dayOf, useMoments, useMorningNote } from "@/lib/teamData";
import { useToast } from "@/lib/toast";

const tomorrowOf = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return dayOf(d);
};
const dayName = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

/**
 * Leah's morning message: one note to the whole team at the top of the
 * dashboard. She writes today's, or tomorrow's the night before; until a
 * new one is written, the last one stays up, dated.
 */
export function MorningNote() {
  const { me, team } = useSession();
  const { note, today, loading, write } = useMorningNote();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [forDate, setForDate] = useState(today);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = Boolean(me?.is_admin);

  useEffect(() => {
    if (!open) return;
    setForDate(today);
    setBody(note?.for_date === today ? note.body : "");
  }, [open, note, today]);

  if (loading) return null;
  if (!note && !admin) return null;

  const save = async () => {
    if (!body.trim()) return toast({ title: "A line or two for the team", tone: "amber" });
    setBusy(true);
    const failed = await write(forDate, body);
    setBusy(false);
    if (failed) return toast({ title: "That didn't save", body: failed, tone: "rust" });
    toast({ title: forDate === today ? "The team sees it now" : `It goes up ${dayName(forDate)}`, icon: Sun, tone: "gold" });
    setOpen(false);
  };

  const author = team.find((p) => p.email === note?.author) || team.find((p) => p.assigns_tasks) || { name: "Leah" };
  const fresh = note?.for_date === today;

  return (
    <>
      {note ? (
        <section className="cc-glass cc-card cc-rise" aria-label="The morning message" style={{ position: "relative" }}>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
            <Monogram name={author.name} tone="gold" size={30} />
            <div className="min-w-0" style={{ flex: 1 }}>
              <p className="t-eyebrow" style={{ color: "var(--cc-gold)" }}>
                {fresh ? "This morning" : dayName(note.for_date)}
              </p>
              <p className="t-cap1 cc-tertiary">From {author.name}</p>
            </div>
            {admin ? (
              <button type="button" className="cc-icon-press" onClick={() => setOpen(true)} aria-label="Write the morning message" title="Write the morning message">
                <PenLine size={16} />
              </button>
            ) : null}
          </div>
          <p className="cc-label" style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1.4, margin: 0, whiteSpace: "pre-wrap" }}>
            {note.body}
          </p>
        </section>
      ) : (
        <button type="button" className="cc-glass cc-lift cc-row" onClick={() => setOpen(true)} style={{ borderRadius: 16, padding: "10px 14px", minHeight: 60, width: "100%", textAlign: "left" }}>
          <IconTile icon={Sun} tone="gold" />
          <span className="cc-row-main">
            <span className="t-sub t-strong cc-label" style={{ display: "block" }}>
              Write this morning's message
            </span>
            <span className="t-cap1 cc-tertiary" style={{ display: "block" }}>
              A line or two at the top of everyone's dashboard
            </span>
          </span>
          <ChevronRight size={16} className="cc-tertiary" aria-hidden="true" />
        </button>
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="The morning message"
        footer={
          <button type="button" className="cc-btn cc-btn-primary" onClick={save} disabled={busy}>
            {forDate === today ? "Put it up" : "Schedule it"}
          </button>
        }
      >
        <div className="cc-form">
          <div className="cc-chips" role="radiogroup" aria-label="For">
            {[
              { value: today, label: "Today" },
              { value: tomorrowOf(today), label: "Tomorrow morning" }
            ].map((choice) => (
              <button key={choice.value} type="button" role="radio" aria-checked={forDate === choice.value} className="cc-chip cc-chip-sm" onClick={() => setForDate(choice.value)}>
                {choice.label}
              </button>
            ))}
          </div>
          <textarea
            className="cc-input cc-textarea"
            style={{ fontFamily: "var(--font-display)", fontSize: 18, minHeight: 150 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder="Good morning, team. Today is about the members who joined this week: every one of them gets a personal hello."
            aria-label="The message"
            autoFocus
          />
          <p className="t-cap1 cc-tertiary">It sits at the top of everyone's dashboard until the next one.</p>
        </div>
      </Sheet>
    </>
  );
}

/** The next milestone, one line under the hero: "38 members away from 500." */
export function NextMilestone({ score }) {
  if (!score) return null;
  const members = nextStep(score.members_total, MILESTONES.members.steps);
  const paying = nextStep(score.active_paying, MILESTONES.paying.steps);
  // The closer of the two, by how much of the way there it is.
  const pick = [members && { ...members, what: "members" }, paying && { ...paying, what: "paying members" }].filter(Boolean).sort((a, b) => b.ratio - a.ratio)[0];
  if (!pick) return null;
  return (
    <Link to="/dream" className="cc-glass cc-lift flex items-center" style={{ gap: 10, borderRadius: 999, padding: "8px 14px 8px 10px", textDecoration: "none", alignSelf: "flex-start", maxWidth: "100%" }}>
      <Trophy size={16} style={{ color: "var(--cc-gold)", flexShrink: 0 }} aria-hidden="true" />
      <span className="t-foot cc-label cc-clip">
        <span className="t-strong">{pick.away.toLocaleString("en-US")}</span> {pick.what} away from {pick.target.toLocaleString("en-US")}
      </span>
      <span className="cc-bar tone-gold" style={{ width: 64, flexShrink: 0, margin: 0 }} aria-hidden="true">
        <span style={{ width: `${Math.round(pick.ratio * 100)}%` }} />
      </span>
      <ChevronRight size={15} className="cc-tertiary" style={{ flexShrink: 0 }} aria-hidden="true" />
    </Link>
  );
}

const MARK_WORDS = { 30: "30 days", 90: "90 days", 365: "One year", 730: "Two years" };

/** Members' 30 day, 90 day and one year marks this week: a moment to say something. */
export function ComingUp() {
  const moments = useMoments();
  if (!moments?.length) return null;
  const today = dayOf();
  return (
    <Card title="Coming up" caption="Member moments this week">
      <div className="cc-rows">
        {moments.slice(0, 8).map((m) => (
          <div key={`${m.id}-${m.days}`} className="cc-row" style={{ minHeight: 50 }}>
            <IconTile icon={CalendarHeart} tone={m.days >= 365 ? "gold" : "plum"} size={28} />
            <span className="cc-row-main">
              <span className="t-sub t-strong cc-label" style={{ display: "block" }}>
                {m.first_name || "A member"}
              </span>
              <span className="t-cap1 cc-tertiary" style={{ display: "block" }}>
                {MARK_WORDS[m.days] || `${m.days} days`} in The Practice
              </span>
            </span>
            <span className="t-foot cc-secondary" style={{ whiteSpace: "nowrap" }}>
              {m.on === today ? "Today" : new Date(`${m.on}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
            </span>
          </div>
        ))}
      </div>
      {moments.length > 8 ? <p className="t-cap1 cc-tertiary" style={{ padding: "8px 0 4px" }}>And {moments.length - 8} more this week.</p> : null}
    </Card>
  );
}
