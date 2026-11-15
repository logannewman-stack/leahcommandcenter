import React from "react";
import { AlignLeft, CalendarDays, Check, Repeat } from "lucide-react";
import { Monogram } from "@/components/ui";
import TaskCheck from "@/components/todos/TaskCheck";
import { clock } from "@/lib/kinds";
import { dueLabel, localISO, repeatOf, shortDate } from "@/lib/tasks";

/**
 * One to-do: the check, the title (struck through, gently, once done) and a
 * line of what matters about it: who has it (in Leah's everyone view), when
 * it is due or when it was done and by whom, how often it repeats, a note.
 * Tapping anywhere but the check opens it.
 */
export default function TaskRow({ task, person, doneBy, showWho, today, onToggle, onOpen }) {
  const done = task.status === "done";
  const due = dueLabel(task.due_on, today);
  const repeat = repeatOf(task.repeat);
  const doneDay = task.done_at ? localISO(new Date(task.done_at)) : "";
  const when = !task.done_at ? "" : doneDay === today ? clock(task.done_at) : shortDate(doneDay, today);
  const by = doneBy && doneBy.email !== task.assignee_email ? ` by ${doneBy.name}` : "";

  return (
    <div className={`cc-task ${done ? "is-done" : ""} ${task.pending ? "is-pending" : ""}`}>
      <TaskCheck done={done} late={due.tone === "late"} title={task.title} onToggle={() => onToggle(task, !done)} disabled={task.pending} />
      <button type="button" className="cc-task-open" onClick={() => onOpen(task)} aria-label={`Open "${task.title}"`}>
        <span className="cc-task-title">
          <span>{task.title}</span>
        </span>
        <span className="cc-task-meta">
          {showWho && person ? (
            <span className="cc-meta cc-meta-who">
              <Monogram name={person.name} tone={person.tone} size={18} />
              {person.name}
            </span>
          ) : null}
          {done ? (
            <span className="cc-meta is-done">
              <Check size={12} strokeWidth={2.6} aria-hidden="true" />
              Done{by}
              {when ? ` · ${when}` : ""}
            </span>
          ) : due.text ? (
            <span className={`cc-meta is-${due.tone}`}>
              <CalendarDays size={12} strokeWidth={2.2} aria-hidden="true" />
              {due.text}
            </span>
          ) : null}
          {repeat.short && !done ? (
            <span className="cc-meta">
              <Repeat size={12} strokeWidth={2.2} aria-hidden="true" />
              {repeat.short}
            </span>
          ) : null}
          {task.notes ? (
            <span className="cc-meta" title={task.notes}>
              <AlignLeft size={12} strokeWidth={2.2} aria-hidden="true" />
              Note
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
