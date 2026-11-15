import React, { useEffect, useState } from "react";
import { Check, Coins, MapPin, PenLine, Plus, Target, Trash2, Trophy } from "lucide-react";
import { Bar, Card, EmptyState, IconTile, Page, RefreshButton, Sheet } from "@/components/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useCities, useGoals } from "@/lib/teamData";
import { useToast } from "@/lib/toast";
import { METRICS, MILESTONES, goalNumber, goalValue, metricOf, nextStep, reached } from "@/lib/goals";
import { dateShort, money } from "@/lib/format";

const plain = (n) => (Number(n) || 0).toLocaleString("en-US");
const dollars = (cents, short) => (short && cents >= 100000 ? `$${Number((cents / 100000).toFixed(1))}K` : money(cents));

function Field({ label, children }) {
  return (
    <label className="block">
      <p className="cc-form-label">{label}</p>
      {children}
    </label>
  );
}

function VisionSheet({ open, onClose, settings, onSaved }) {
  const { toast } = useToast();
  const [vision, setVision] = useState("");
  const [mission, setMission] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setVision(settings?.vision || "");
    setMission(settings?.mission || "");
  }, [open, settings]);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("cc_settings").update({ vision: vision.trim(), mission: mission.trim() }).eq("id", true);
    setBusy(false);
    if (error) return toast({ title: "That didn't save", body: error.message, tone: "rust" });
    onSaved();
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="The vision and the mission"
      footer={
        <button type="button" className="cc-btn cc-btn-primary" onClick={save} disabled={busy}>
          Save
        </button>
      }
    >
      <div className="cc-form">
        <Field label="The vision">
          <textarea className="cc-input cc-textarea" style={{ fontFamily: "var(--font-display)", fontSize: 17, minHeight: 120 }} value={vision} onChange={(e) => setVision(e.target.value)} maxLength={600} />
        </Field>
        <Field label="The mission, in one line">
          <input className="cc-input" value={mission} onChange={(e) => setMission(e.target.value)} maxLength={240} />
        </Field>
      </div>
    </Sheet>
  );
}

const BLANK = { title: "", metric: "members_total", target: "", manual_value: 0, by_date: "", sort: 0 };

function GoalSheet({ open, onClose, goal, onSave, onRemove }) {
  const { toast } = useToast();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setForm(goal ? { ...BLANK, ...goal, by_date: goal.by_date || "" } : BLANK);
  }, [open, goal]);
  const set = (patch) => setForm((now) => ({ ...now, ...patch }));
  const save = async () => {
    const target = Number(form.target);
    if (!form.title.trim()) return toast({ title: "Name the goal", tone: "amber" });
    if (!(target > 0)) return toast({ title: "A number to reach", tone: "amber" });
    setBusy(true);
    const failed = await onSave(
      { title: form.title.trim(), metric: form.metric, target, manual_value: Number(form.manual_value) || 0, by_date: form.by_date || null, sort: Number(form.sort) || 0 },
      goal?.id
    );
    setBusy(false);
    if (failed) return toast({ title: "That didn't save", body: failed, tone: "rust" });
    onClose();
  };
  const remove = async () => {
    setBusy(true);
    const failed = await onRemove(goal.id);
    setBusy(false);
    if (failed) return toast({ title: "That didn't come off", body: failed, tone: "rust" });
    onClose();
  };
  const unit = metricOf(form.metric).unit;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? "Change the goal" : "A big goal"}
      footer={
        <>
          {goal ? (
            <button type="button" className="cc-btn cc-btn-quiet cc-btn-danger" onClick={remove} disabled={busy} style={{ marginRight: "auto" }}>
              <Trash2 size={15} /> Remove
            </button>
          ) : null}
          <button type="button" className="cc-btn cc-btn-primary" onClick={save} disabled={busy}>
            {goal ? "Save" : "Put it on the board"}
          </button>
        </>
      }
    >
      <div className="cc-form">
        <Field label="The goal">
          <input className="cc-input cc-input-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="1,000 members by the end of 2027" maxLength={120} />
        </Field>
        <Field label="Its bar fills from">
          <select className="cc-input" value={form.metric} onChange={(e) => set({ metric: e.target.value })}>
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="cc-grid-2">
          <Field label={`Target${unit === "$" ? " ($)" : ""}`}>
            <input className="cc-input" type="number" min={1} step="any" value={form.target} onChange={(e) => set({ target: e.target.value })} />
          </Field>
          <Field label="By (optional)">
            <input className="cc-input" type="date" value={form.by_date} onChange={(e) => set({ by_date: e.target.value })} />
          </Field>
        </div>
        {form.metric === "manual" ? (
          <Field label="Where it stands now">
            <input className="cc-input" type="number" step="any" value={form.manual_value} onChange={(e) => set({ manual_value: e.target.value })} />
          </Field>
        ) : null}
      </div>
    </Sheet>
  );
}

function PoolSheet({ open, onClose, settings, onSaved }) {
  const { toast } = useToast();
  const [per, setPer] = useState("");
  const [goal, setGoal] = useState("");
  const [reward, setReward] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPer(settings?.pool_per_upgrade_cents ? String(settings.pool_per_upgrade_cents / 100) : "");
    setGoal(settings?.pool_goal_upgrades ? String(settings.pool_goal_upgrades) : "");
    setReward(settings?.pool_reward || "");
  }, [open, settings]);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("cc_settings")
      .update({ pool_per_upgrade_cents: Math.round((Number(per) || 0) * 100), pool_goal_upgrades: Math.max(0, Math.round(Number(goal) || 0)), pool_reward: reward.trim() })
      .eq("id", true);
    setBusy(false);
    if (error) return toast({ title: "That didn't save", body: error.message, tone: "rust" });
    onSaved();
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="The team bonus pool"
      footer={
        <button type="button" className="cc-btn cc-btn-primary" onClick={save} disabled={busy}>
          Save the pool
        </button>
      }
    >
      <div className="cc-form">
        <p className="t-foot cc-secondary">So much goes into the pool for each trial that upgrades. When the team hits the month's goal, it pays out evenly.</p>
        <div className="cc-grid-2">
          <Field label="Per upgrade ($)">
            <input className="cc-input" type="number" min={0} step="any" value={per} onChange={(e) => setPer(e.target.value)} placeholder="25" />
          </Field>
          <Field label="The month's goal (upgrades)">
            <input className="cc-input" type="number" min={0} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="20" />
          </Field>
        </div>
        <Field label="What it unlocks (optional)">
          <input className="cc-input" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={120} placeholder="Split evenly, plus a team dinner" />
        </Field>
      </div>
    </Sheet>
  );
}

/** One milestone track: the steps behind, the next one, and how far away it is. */
function Track({ title, icon, tone, value, steps, format }) {
  const next = nextStep(value, steps);
  const top = reached(value, steps);
  const shown = steps.filter((step) => step <= (next?.target || top)).slice(-4);
  return (
    <Card>
      <div className="flex items-center" style={{ gap: 11 }}>
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="t-num cc-label" style={{ fontSize: 26, lineHeight: "30px" }}>
            {format(value)}
          </p>
          <h3 className="t-eyebrow cc-tertiary">{title}</h3>
        </div>
      </div>
      <div className="cc-chips" style={{ flexWrap: "wrap", overflow: "visible", margin: "12px 0 0", padding: 0 }}>
        {shown.map((step) => {
          const hit = value >= step;
          return (
            <span
              key={step}
              className="cc-chip cc-chip-sm"
              style={hit ? { background: "var(--cc-press-grad)", color: "var(--cc-press-ink)", boxShadow: "var(--cc-press-shadow)", cursor: "default" } : { cursor: "default" }}
              title={hit ? "Reached" : "Next"}
            >
              {hit ? <Check size={13} /> : <Trophy size={13} />} {format(step, true)}
            </span>
          );
        })}
      </div>
      {next ? (
        <>
          <Bar value={next.ratio} tone={tone} />
          <p className="t-cap1 cc-tertiary" style={{ marginTop: 8 }}>
            {format(next.away, true)} away from {format(next.target, true)}
          </p>
        </>
      ) : (
        <p className="t-cap1 cc-tertiary" style={{ marginTop: 8 }}>
          Every step on this track, reached.
        </p>
      )}
    </Card>
  );
}

/**
 * The Dream Board: Leah's vision and mission, the big goals with bars that
 * fill from the live numbers, the team bonus pool, the milestone tracks and
 * the cities the movement has reached.
 */
export default function Dream() {
  const { me, settings, refresh } = useSession();
  const [score, setScore] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const { goals, loading, save, remove } = useGoals();
  const cities = useCities();
  const [editVision, setEditVision] = useState(false);
  const [editPool, setEditPool] = useState(false);
  const [goal, setGoal] = useState(null);
  const admin = Boolean(me?.is_admin);

  const load = async () => {
    const { data } = await supabase.rpc("cc_scoreboard");
    setScore(data || {});
  };
  useEffect(() => {
    load();
  }, []);
  const s = score || {};
  const upgrades = Number(s.upgrades_month) || 0;
  const per = Number(settings?.pool_per_upgrade_cents) || 0;
  const poolGoal = Number(settings?.pool_goal_upgrades) || 0;
  const most = cities.length ? Math.max(...cities.map((c) => Number(c.members) || 0)) : 1;
  const year = new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0);

  return (
    <Page
      title="Dream Board"
      subtitle={`Leah's ${year} vision, the big goals, and how far the movement has come`}
      right={
        <RefreshButton
          busy={spinning}
          onClick={async () => {
            setSpinning(true);
            await Promise.all([load(), refresh()]);
            setSpinning(false);
          }}
        />
      }
    >
      <section className="cc-hero cc-rise" style={{ display: "block", padding: "26px 24px", textAlign: "left", color: "#f2ece0" }} aria-label="The vision">
        <div className="flex items-start justify-between gap-3">
          <p className="cc-hero-label" style={{ margin: 0 }}>
            The vision · {year}
          </p>
          {admin ? (
            <button type="button" className="cc-link-button" onClick={() => setEditVision(true)} style={{ color: "#cbb089", minHeight: 0, padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PenLine size={14} /> {settings?.vision ? "Change" : "Write it"}
            </button>
          ) : null}
        </div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 3.4vw, 34px)", lineHeight: 1.2, margin: "12px 0 0", maxWidth: 780 }}>
          {settings?.vision || "People feel better in their life, not just have a life that looks good from the outside."}
        </p>
        <p style={{ marginTop: 14, opacity: 0.78, fontSize: 15, lineHeight: 1.5, maxWidth: 680 }}>
          {settings?.mission || "Joy is accessible, even in challenge and even in struggle. That is what we practice here."}
        </p>
      </section>

      <Card
        title="Where we're headed"
        caption={
          admin ? (
            <button type="button" className="cc-link-button" onClick={() => setGoal({})} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Plus size={14} /> Add a goal
            </button>
          ) : undefined
        }
      >
        {loading ? null : goals.length ? (
          <div className="cc-grid-3" style={{ paddingBottom: 6 }}>
            {goals.map((g) => {
              const value = goalValue(g, s);
              const ratio = Math.min(1, value / Number(g.target));
              const done = ratio >= 1;
              return (
                <button key={g.id} type="button" className="cc-glass" style={{ borderRadius: 16, padding: "14px 14px 12px", textAlign: "left", cursor: admin ? "pointer" : "default" }} onClick={() => admin && setGoal(g)} disabled={!admin}>
                  <p className="t-eyebrow cc-tertiary">{metricOf(g.metric).label}</p>
                  <p className="t-headline cc-label" style={{ marginTop: 4 }}>
                    {g.title}
                  </p>
                  <div className="flex items-baseline justify-between" style={{ marginTop: 12 }}>
                    <p className="t-num cc-label" style={{ fontSize: 24 }}>
                      {goalNumber(value, g.metric)} <span className="cc-tertiary" style={{ fontSize: 15 }}>/ {goalNumber(g.target, g.metric)}</span>
                    </p>
                    <span className="t-foot t-strong" style={{ color: done ? "var(--cc-gold)" : undefined }}>
                      {Math.floor(ratio * 100)}%
                    </span>
                  </div>
                  <Bar value={ratio} tone={done ? "gold" : "navy"} />
                  {g.by_date || done ? <p className="t-cap1 cc-tertiary" style={{ marginTop: 6 }}>{done ? "Reached." : `By ${dateShort(`${g.by_date}T12:00:00`)}`}</p> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="No goals on the board yet"
            sub="Leah's big goals, each with a bar that fills from the live numbers: members, paying members, a $10K month."
            action={
              admin ? (
                <button type="button" className="cc-btn cc-btn-primary" onClick={() => setGoal({})}>
                  <Plus size={15} /> Add the first goal
                </button>
              ) : null
            }
          />
        )}
      </Card>

      <div className="cc-grid-2">
        <Card
          title="Team bonus pool"
          caption={
            admin ? (
              <button type="button" className="cc-link-button" onClick={() => setEditPool(true)}>
                {per ? "Change" : "Set it up"}
              </button>
            ) : undefined
          }
        >
          {per ? (
            <div style={{ paddingBottom: 8 }}>
              <div className="flex items-center" style={{ gap: 11 }}>
                <IconTile icon={Coins} tone="gold" />
                <div>
                  <p className="t-num cc-label" style={{ fontSize: 30, lineHeight: "34px" }}>
                    {money(upgrades * per)}
                  </p>
                  <p className="t-cap1 cc-tertiary">
                    this month · {upgrades} upgrade{upgrades === 1 ? "" : "s"} × {money(per)}
                  </p>
                </div>
              </div>
              {poolGoal ? (
                <>
                  <Bar value={Math.min(1, upgrades / poolGoal)} tone="gold" />
                  <p className="t-cap1 cc-tertiary" style={{ marginTop: 8 }}>
                    {upgrades >= poolGoal ? "Goal reached. It pays out evenly." : `${poolGoal - upgrades} more upgrades to unlock it.`}
                    {settings?.pool_reward ? ` ${settings.pool_reward}.` : ""}
                  </p>
                </>
              ) : null}
            </div>
          ) : (
            <p className="t-foot cc-secondary" style={{ paddingBottom: 10 }}>
              A set amount for each trial that upgrades, toward a monthly goal the whole team can see. {admin ? "Set the amount and the goal to start it." : "Leah and Logan set it up."}
            </p>
          )}
        </Card>
        <Card title="Where the movement is" caption={cities.length ? `${cities.length} cities` : undefined}>
          {cities.length ? (
            <div className="cc-chips" style={{ flexWrap: "wrap", overflow: "visible", margin: 0, padding: "0 0 10px" }}>
              {cities.map((c) => {
                const weight = (Number(c.members) || 1) / most;
                return (
                  <span key={c.city} className="cc-chip" style={{ fontSize: 13 + weight * 5 }} title={`${c.members} joined from ${c.city}`}>
                    <MapPin size={13} /> {c.city} <span className="cc-count">{c.members}</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="t-foot cc-secondary" style={{ paddingBottom: 10 }}>
              Each new member's city, from their checkout, lights up here. City only, never an exact place.
            </p>
          )}
        </Card>
      </div>

      <div className="cc-grid-3">
        <Track title="Members" icon={Trophy} tone="navy" value={Number(s.members_total) || 0} steps={MILESTONES.members.steps} format={plain} />
        <Track title="Paying members" icon={Trophy} tone="green" value={Number(s.active_paying) || 0} steps={MILESTONES.paying.steps} format={plain} />
        <Track title="A month, recurring" icon={Trophy} tone="gold" value={Number(s.mrr_cents) || 0} steps={MILESTONES.mrr.steps} format={dollars} />
      </div>

      <VisionSheet open={editVision} onClose={() => setEditVision(false)} settings={settings} onSaved={refresh} />
      <PoolSheet open={editPool} onClose={() => setEditPool(false)} settings={settings} onSaved={refresh} />
      <GoalSheet open={Boolean(goal)} onClose={() => setGoal(null)} goal={goal?.id ? goal : null} onSave={save} onRemove={remove} />
    </Page>
  );
}
