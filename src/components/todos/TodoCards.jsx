import React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, ListChecks, Sparkles } from "lucide-react";
import { Bar, Card, EmptyLine, Monogram, Ring } from "@/components/ui";
import TaskCheck from "@/components/todos/TaskCheck";
import { dueLabel, groupTasks, progressFor } from "@/lib/tasks";
import { useTasks } from "@/lib/tasksStore";

/**
 * The dashboard's to-do cards: everyone's own list at a glance, checkable
 * right there; and, for Leah, the team's day, person by person.
 */
export function YourTodosCard() {
  const { mine, today, email, personOf, setDone } = useTasks();
  const me = personOf(email);
  const day = progressFor(mine, email, today);
  const groups = groupTasks(mine, today);
  const next = [...groups.overdue, ...groups.today, ...groups.upcoming, ...groups.someday].slice(0, 4);
  return (
    <Card title="Your to-dos" caption={day.total ? `${day.done} of ${day.total} done today` : undefined}>
      <div className="flex items-start" style={{ gap: 14, paddingTop: 2 }}>
        <Ring value={day.ratio} size={58} stroke={6} tone={me.tone} label={`${day.done} of ${day.total} done today`}>
          <span className="t-num cc-label" style={{ fontSize: 16 }}>
            {day.left || (day.total ? "✓" : 0)}
          </span>
        </Ring>
        <div className="min-w-0" style={{ flex: 1 }}>
          {next.length ? (
            <div className="cc-rows">
              <AnimatePresence initial={false}>
                {next.map((task) => {
                  const due = dueLabel(task.due_on, today);
                  return (
                    <motion.div key={task.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="cc-mini-task">
                      <TaskCheck done={task.status === "done"} late={due.tone === "late"} title={task.title} onToggle={() => setDone(task, task.status !== "done")} />
                      <span className="cc-row-main">
                        <span className="t-foot t-strong cc-label cc-clip" style={{ display: "block" }}>
                          {task.title}
                        </span>
                        {due.text ? <span className={`t-cap1 cc-meta is-${due.tone}`}>{due.text}</span> : null}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyLine icon={Sparkles} tone="gold" title="Your list is clear." sub="New to-dos from Leah show up here the moment she gives them." />
          )}
        </div>
      </div>
      <Link to="/todos" className="cc-row" style={{ minHeight: 44, marginTop: 4 }}>
        <span className="cc-row-main t-foot t-strong cc-secondary">See your whole list</span>
        <ChevronRight size={16} strokeWidth={2.4} className="cc-chevron" aria-hidden="true" />
      </Link>
    </Card>
  );
}

export function TeamTodayCard() {
  const { tasks, people, today } = useTasks();
  const all = progressFor(tasks, null, today);
  const rows = people
    .map((person) => ({ person, day: progressFor(tasks, person.email, today), open: tasks.filter((t) => t.assignee_email === person.email && t.status === "open").length }))
    .filter((row) => row.day.total || row.open);
  return (
    <Card title="Team today" caption={all.total ? `${all.done} of ${all.total} done` : undefined}>
      {rows.length ? (
        <div className="cc-rows">
          {rows.map(({ person, day, open }) => (
            <Link key={person.email} to={`/todos?who=${encodeURIComponent(person.email)}`} className="cc-row" style={{ minHeight: 54 }}>
              <Monogram name={person.name} tone={person.tone} size={32} />
              <span className="cc-row-main">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="t-sub t-strong cc-label">{person.name}</span>
                  <span className={`t-cap1 ${day.total && !day.left ? "cc-done-text" : "cc-tertiary"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {day.total ? (day.left ? `${day.done}/${day.total}` : "All done") : `${open} open`}
                  </span>
                </span>
                <Bar value={day.total ? day.ratio : 0} tone={person.tone} />
              </span>
              <ChevronRight size={16} strokeWidth={2.4} className="cc-chevron" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyLine icon={ListChecks} tone="navy" title="No to-dos given out yet." sub="Give the team its first ones on To-dos." />
      )}
    </Card>
  );
}
