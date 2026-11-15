import React, { useEffect, useState } from "react";
import { CalendarDays, Check, Repeat, Trash2, Undo2, UserRound } from "lucide-react";
import { Badge, Monogram, Sheet, Switch } from "@/components/ui";
import PeoplePicker from "@/components/todos/PeoplePicker";
import { useTasks } from "@/lib/tasksStore";
import { REPEATS, dueChoices, dueLabel, repeatOf, shortDate } from "@/lib/tasks";

/**
 * One to-do, opened. For Leah, the editor: the title, a note, who it is
 * for, when it is due, how often it repeats, done or not, and delete. For
 * everyone else, what Leah wrote and one big button: done, or not done.
 *
 * `task` null with `draft` set is a new to-do, started from the quick add.
 */
export default function TaskSheet({ open, task, draft, onClose }) {
  const { lead, people, today, personOf, create, update, remove, setDone } = useTasks();
  const isNew = !task;
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState(null);
  const [repeat, setRepeat] = useState("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const source = task || draft || {};
    setTitle(source.title || "");
    setNotes(source.notes || "");
    setAssignee(source.assignee_email || people.find((p) => !p.lead)?.email || people[0]?.email || "");
    setDue(source.due_on === undefined ? today : source.due_on);
    setRepeat(source.repeat || "none");
    setSaving(false);
    // Only when it opens, or a different to-do is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const done = task?.status === "done";
  const owner = task ? personOf(task.assignee_email) : null;
  const from = task?.created_by ? personOf(task.created_by) : null;

  if (!lead) {
    // A teammate's view: what it is, and done.
    const dueText = task?.due_on ? `${dueLabel(task.due_on, today).text}${dueLabel(task.due_on, today).tone === "later" ? "" : ` · ${shortDate(task.due_on, today)}`}` : "Anytime";
    return (
      <Sheet
        open={open}
        onClose={onClose}
        label={task?.title || "To-do"}
        footer={
          task ? (
            <button
              type="button"
              className={`cc-btn ${done ? "cc-btn-quiet" : "cc-btn-primary"}`}
              style={{ width: "100%", height: 50, fontSize: 16 }}
              onClick={() => {
                setDone(task, !done);
                onClose();
              }}
            >
              {done ? <Undo2 size={18} aria-hidden="true" /> : <Check size={18} strokeWidth={2.6} aria-hidden="true" />}
              {done ? "Mark not done" : "Mark done"}
            </button>
          ) : null
        }
      >
        {task ? (
          <div className="cc-form">
            <h2 className="t-title3 cc-label" style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 24, lineHeight: "30px" }}>
              {task.title}
            </h2>
            {task.notes ? <p className="t-sub cc-secondary" style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{task.notes}</p> : null}
            <div className="cc-rows">
              <Fact icon={CalendarDays} label="Due" value={dueText} />
              {task.repeat !== "none" ? <Fact icon={Repeat} label="Repeats" value={repeatOf(task.repeat).label} /> : null}
              {from ? <Fact icon={UserRound} label="From" value={from.name} /> : null}
              {done ? <Fact icon={Check} label="Done" value={task.done_at ? new Date(task.done_at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Yes"} /> : null}
            </div>
          </div>
        ) : null}
      </Sheet>
    );
  }

  const save = async (event) => {
    event?.preventDefault?.();
    if (!title.trim() || !assignee || saving) return;
    setSaving(true);
    const fields = { title: title.trim(), notes: notes.trim() || null, assignee_email: assignee, due_on: due || null, repeat };
    const ok = isNew ? await create(fields) : await update(task.id, fields);
    setSaving(false);
    if (ok) onClose();
  };

  const customDue = due && !dueChoices(today).some((c) => c.value === due);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? "New to-do" : "To-do"}
      footer={
        <div className="flex items-center gap-2">
          {!isNew ? (
            <button
              type="button"
              className="cc-btn cc-btn-quiet cc-btn-danger"
              onClick={() => {
                remove(task);
                onClose();
              }}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" className="cc-btn cc-btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="cc-task-form" className="cc-btn cc-btn-primary" disabled={!title.trim() || !assignee || saving}>
            {isNew ? "Give it out" : "Save"}
          </button>
        </div>
      }
    >
      <form id="cc-task-form" className="cc-form" onSubmit={save}>
        <input
          className="cc-input cc-input-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          aria-label="Title"
          maxLength={200}
          autoFocus={isNew}
        />
        <textarea className="cc-input cc-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note (optional)" aria-label="Note" maxLength={2000} rows={3} />

        <div>
          <p className="cc-form-label">For</p>
          <PeoplePicker people={people} value={assignee} onChange={setAssignee} />
        </div>

        <div>
          <p className="cc-form-label">Due</p>
          <div className="flex flex-wrap items-center gap-2">
            {dueChoices(today).map((choice) => (
              <button key={choice.label} type="button" className="cc-chip cc-chip-sm" aria-pressed={due === choice.value} onClick={() => setDue(choice.value)}>
                {choice.label}
              </button>
            ))}
            <label className={`cc-chip cc-chip-sm cc-date-chip ${customDue ? "is-set" : ""}`}>
              <CalendarDays size={14} aria-hidden="true" />
              {customDue ? shortDate(due, today) : "Pick a day"}
              <input type="date" value={due || ""} min={today} onChange={(e) => setDue(e.target.value || null)} aria-label="Pick a day" />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="cc-form-label" style={{ marginBottom: 2 }}>
              Repeats
            </p>
            <p className="t-cap1 cc-tertiary">Done makes the next one</p>
          </div>
          <select className="cc-input" style={{ width: "auto", minWidth: 180, height: 40, fontSize: 15 }} value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-label="Repeats">
            {REPEATS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {!isNew ? (
          <div className="cc-rows">
            <div className="cc-row" style={{ minHeight: 52 }}>
              <span className="cc-row-main">
                <span className="t-sub t-strong cc-label" style={{ display: "block" }}>
                  Done
                </span>
                <span className="t-cap1 cc-tertiary" style={{ display: "block" }}>
                  {done && task.done_by ? `By ${personOf(task.done_by).name}` : `${owner?.name || "They"} can check it off too`}
                </span>
              </span>
              <Switch checked={done} onChange={(on) => setDone(task, on)} label="Done" />
            </div>
            {from ? (
              <div className="cc-row" style={{ minHeight: 48 }}>
                <span className="cc-row-main t-foot cc-tertiary">Given out by</span>
                <span className="flex items-center gap-2 t-foot cc-label">
                  <Monogram name={from.name} tone={from.tone} size={22} /> {from.name}
                </span>
              </div>
            ) : null}
            {task.repeat !== "none" ? (
              <div className="cc-row" style={{ minHeight: 48 }}>
                <span className="cc-row-main t-foot cc-tertiary">Repeating</span>
                <Badge tone="navy">{repeatOf(task.repeat).short}</Badge>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="cc-row" style={{ minHeight: 48 }}>
      <Icon size={17} className="cc-tertiary" aria-hidden="true" />
      <span className="cc-row-main t-foot cc-tertiary">{label}</span>
      <span className="t-foot cc-label" style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
