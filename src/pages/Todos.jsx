import React, { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ListChecks, Plus, Sparkles } from "lucide-react";
import QuickAdd from "@/components/todos/QuickAdd";
import TaskRow from "@/components/todos/TaskRow";
import TaskSheet from "@/components/todos/TaskSheet";
import TeamStrip from "@/components/todos/TeamStrip";
import { Card, EmptyState, Monogram, Notice, Page, RefreshButton, Ring, Skeleton } from "@/components/ui";
import { clock } from "@/lib/kinds";
import { updatedLabel, useTick } from "@/lib/live";
import { SECTIONS, groupTasks, progressFor, sectionOf } from "@/lib/tasks";
import { useTasks } from "@/lib/tasksStore";

const SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 };
const HOLD_MS = 650;

/**
 * The team's to-dos.
 *
 * Leah (whoever gives them out) sees the whole team: a ring per person that
 * fills as their day gets done, a quick add that gives a to-do to anyone in
 * one line, every list, and, beside it on a laptop, each check-off as it
 * happens. Everyone else sees their own list and checks things off; Leah
 * sees it the same second.
 */
export default function Todos() {
  const { tasks, mine, loading, error, at, today, lead, email, people, personOf, reload, setDone, create } = useTasks();
  const [params, setParams] = useSearchParams();
  useTick(30_000);
  const who = lead ? params.get("who") || "all" : email;
  const [sheet, setSheet] = useState({ open: false, task: null, draft: null });
  const [showEarlier, setShowEarlier] = useState(false);
  const [hold, setHold] = useState(() => new Map());
  const holdTimers = useRef(new Map());
  const [spinning, setSpinning] = useState(false);

  const visible = useMemo(() => (lead ? (who === "all" ? tasks : tasks.filter((t) => t.assignee_email === who)) : mine), [lead, who, tasks, mine]);
  const groups = useMemo(() => groupTasks(visible, today, hold), [visible, today, hold]);

  const choose = (value) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("who");
    else next.set("who", value);
    setParams(next, { replace: true });
  };

  // A checked to-do stays where it was for a moment, checked, then moves to Done.
  const toggle = useCallback(
    (task, done) => {
      const section = sectionOf(task, today);
      setHold((now) => new Map(now).set(task.id, section));
      clearTimeout(holdTimers.current.get(task.id));
      holdTimers.current.set(
        task.id,
        setTimeout(() => {
          setHold((now) => {
            const next = new Map(now);
            next.delete(task.id);
            return next;
          });
        }, HOLD_MS)
      );
      setDone(task, done);
    },
    [setDone, today]
  );

  const openTask = (task) => setSheet({ open: true, task, draft: null });
  const openNew = (draft = {}) => setSheet({ open: true, task: null, draft: { due_on: today, ...draft, assignee_email: draft.assignee_email || (who !== "all" ? who : undefined) } });
  const closeSheet = () => setSheet((now) => ({ ...now, open: false }));

  const refresh = async () => {
    setSpinning(true);
    await reload();
    setTimeout(() => setSpinning(false), 450);
  };

  // The list, flat, so a to-do that moves section glides to its new place.
  const entries = [];
  for (const section of SECTIONS) {
    const list = groups[section.id];
    if (!list.length) continue;
    const collapsible = section.id === "doneEarlier";
    const collapsed = collapsible && !showEarlier;
    entries.push({ key: `h-${section.id}`, type: "header", section, count: list.length, collapsible, collapsed });
    if (!collapsed) for (const task of list) entries.push({ key: task.id, type: "task", task });
  }

  const focus = lead && who !== "all" ? personOf(who) : null;
  const day = progressFor(visible, lead && who === "all" ? null : lead ? who : email, today);
  const openCount = visible.filter((t) => t.status === "open").length;
  const subtitle = [
    lead ? `${openCount} open · ${day.done} done today` : day.total ? (day.left ? `${day.left} left today` : "All done for today") : "Nothing due today",
    updatedLabel(at)
  ]
    .filter(Boolean)
    .join(" · ");

  const recent = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "done" && t.done_at)
        .sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)))
        .slice(0, 12),
    [tasks]
  );

  return (
    <Page
      title={lead ? "To-dos" : "Your to-dos"}
      subtitle={subtitle}
      right={
        <>
          {lead ? (
            <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => openNew()} style={{ marginRight: 4 }}>
              <Plus size={15} strokeWidth={2.6} aria-hidden="true" /> New
            </button>
          ) : null}
          <RefreshButton busy={spinning} onClick={refresh} />
        </>
      }
    >
      {error ? (
        <Notice icon={ListChecks} title="To-dos can't be read yet">
          {error}. Until the to-dos migration (20261116000000_team_todos.sql) has run on the Practice's database, there is nothing to show.
        </Notice>
      ) : null}

      {loading ? (
        <div className="cc-stack" aria-hidden="true">
          <Skeleton height={76} />
          <Skeleton height={360} />
        </div>
      ) : (
        <div className={lead ? "cc-todo-layout" : ""}>
          <div className="cc-stack">
            {lead ? (
              <>
                <TeamStrip tasks={tasks} people={people} today={today} value={who} onChange={choose} />
                <QuickAdd people={people} focusEmail={who} today={today} onAdd={create} onMore={openNew} />
              </>
            ) : (
              <MyDay day={day} name={personOf(email).name} tone={personOf(email).tone} />
            )}

            {entries.length ? (
              <section className="cc-glass cc-card cc-tasklist" aria-label={focus ? `${focus.name}'s to-dos` : lead ? "Everyone's to-dos" : "Your to-dos"}>
                <AnimatePresence initial={false}>
                  {entries.map((entry) =>
                    entry.type === "header" ? (
                      <motion.div key={entry.key} layout="position" transition={SPRING} className="cc-task-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <h2 className={`t-eyebrow ${entry.section.id === "overdue" ? "cc-late-text" : "cc-tertiary"}`}>{entry.section.label}</h2>
                        {entry.collapsible ? (
                          <button type="button" className="cc-section-toggle" aria-expanded={!entry.collapsed} onClick={() => setShowEarlier((v) => !v)}>
                            {entry.count} <ChevronDown size={14} style={{ transform: entry.collapsed ? "none" : "rotate(180deg)", transition: "transform .2s" }} aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="t-cap1 cc-tertiary">{entry.count}</span>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key={entry.key}
                        layout="position"
                        className="cc-task-wrap"
                        transition={SPRING}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -16, transition: { duration: 0.16 } }}
                      >
                        <TaskRow
                          task={entry.task}
                          person={personOf(entry.task.assignee_email)}
                          doneBy={entry.task.done_by ? personOf(entry.task.done_by) : null}
                          showWho={lead && who === "all"}
                          today={today}
                          onToggle={toggle}
                          onOpen={openTask}
                        />
                      </motion.div>
                    )
                  )}
                </AnimatePresence>
              </section>
            ) : (
              <Card>
                {lead ? (
                  <EmptyState
                    icon={ListChecks}
                    title={focus ? `Nothing for ${focus.name} yet` : "Give the team its first to-do"}
                    sub={focus ? `Type one above and it lands on ${focus.name}'s list the second you add it.` : "Type one above, pick who it's for, and press Return. It shows on their list right away."}
                  />
                ) : (
                  <EmptyState icon={Sparkles} title="Your list is clear" sub="When Leah gives you a to-do, it shows up here the moment she does." />
                )}
              </Card>
            )}
          </div>

          {lead ? (
            <aside className="cc-todo-aside">
              <Card title="Done lately" caption={recent.length ? "Live" : undefined}>
                {recent.length ? (
                  <div className="cc-rows">
                    <AnimatePresence initial={false}>
                      {recent.map((task) => {
                        const by = personOf(task.done_by || task.assignee_email);
                        const doneToday = task.done_at && new Date(task.done_at).toDateString() === new Date().toDateString();
                        return (
                          <motion.button
                            key={task.id}
                            type="button"
                            layout="position"
                            transition={SPRING}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="cc-row"
                            style={{ minHeight: 52 }}
                            onClick={() => openTask(task)}
                          >
                            <Monogram name={by.name} tone={by.tone} size={30} />
                            <span className="cc-row-main">
                              <span className="t-foot t-strong cc-label cc-clip" style={{ display: "block" }}>
                                {task.title}
                              </span>
                              <span className="t-cap1 cc-tertiary" style={{ display: "block" }}>
                                {by.name} · {doneToday ? clock(task.done_at) : new Date(task.done_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                            </span>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  <p className="t-foot cc-tertiary" style={{ padding: "6px 0 8px" }}>
                    Check-offs show here the second they happen.
                  </p>
                )}
              </Card>
            </aside>
          ) : null}
        </div>
      )}

      <TaskSheet open={sheet.open} task={sheet.task ? tasks.find((t) => t.id === sheet.task.id) || sheet.task : null} draft={sheet.draft} onClose={closeSheet} />
    </Page>
  );
}

/** A teammate's day: the ring, how many are done, and what's left. */
function MyDay({ day, name, tone }) {
  const line = !day.total ? "Nothing due today. Enjoy it." : day.left ? `${day.left} to go. You've got this.` : "Every to-do due today is done.";
  return (
    <div className="cc-myday cc-glass">
      <Ring value={day.ratio} size={74} stroke={7} tone={tone} label={`${day.done} of ${day.total} done today`}>
        <span className="t-num cc-label" style={{ fontSize: 20 }}>
          {day.done}
          <span className="cc-tertiary" style={{ fontSize: 14 }}>
            /{day.total}
          </span>
        </span>
      </Ring>
      <div className="min-w-0">
        <p className="t-eyebrow cc-tertiary">Today, {name}</p>
        <p className="t-title3 cc-label" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22, lineHeight: "28px", marginTop: 2 }}>
          {day.total ? `${day.done} of ${day.total} done` : "All clear"}
        </p>
        <p className="t-foot cc-secondary" style={{ marginTop: 2 }}>
          {line}
        </p>
      </div>
    </div>
  );
}
