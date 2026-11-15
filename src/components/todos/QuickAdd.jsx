import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Plus, SlidersHorizontal } from "lucide-react";
import PeoplePicker from "@/components/todos/PeoplePicker";
import { dueChoices } from "@/lib/tasks";

const LAST_KEY = "cc.todos.lastAssignee";
const lastAssignee = () => {
  try {
    return window.localStorage.getItem(LAST_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * Leah's quick add: type, pick who and when, press Return. It stays open
 * for the next one, so a whole list goes out in a minute. Who it is for
 * starts as the person she is looking at, or the last person she gave one.
 */
export default function QuickAdd({ people, focusEmail, today, onAdd, onMore }) {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const fallback = focusEmail && focusEmail !== "all" ? focusEmail : lastAssignee() || people.find((p) => !p.lead)?.email || people[0]?.email || "";
  const [assignee, setAssignee] = useState(fallback);
  const [due, setDue] = useState(today);
  const wrap = useRef(null);
  const input = useRef(null);

  // Looking at one person: the next to-do is theirs.
  useEffect(() => {
    if (focusEmail && focusEmail !== "all") setAssignee(focusEmail);
  }, [focusEmail]);
  useEffect(() => {
    if (!people.some((p) => p.email === assignee) && people[0]) setAssignee(people.find((p) => !p.lead)?.email || people[0].email);
  }, [people, assignee]);

  const who = people.find((p) => p.email === assignee);
  const ready = Boolean(title.trim() && assignee);

  const submit = (event) => {
    event?.preventDefault?.();
    if (!ready) return;
    onAdd({ title: title.trim(), assignee_email: assignee, due_on: due, repeat: "none" });
    try {
      window.localStorage.setItem(LAST_KEY, assignee);
    } catch {
      // Remembered for the page only.
    }
    setTitle("");
    input.current?.focus();
  };

  return (
    <form
      ref={wrap}
      className={`cc-composer cc-glass ${open ? "is-open" : ""}`}
      onSubmit={submit}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!wrap.current?.contains(event.relatedTarget) && !title.trim()) setOpen(false);
      }}
    >
      <div className="cc-composer-line">
        <span className="cc-composer-plus" aria-hidden="true">
          <Plus size={18} strokeWidth={2.4} />
        </span>
        <input
          ref={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={who ? `Add a to-do for ${who.name}` : "Add a to-do"}
          aria-label="New to-do"
          maxLength={200}
          enterKeyHint="send"
        />
        <AnimatePresence initial={false}>
          {ready ? (
            <motion.button
              key="send"
              type="submit"
              className="cc-composer-send"
              aria-label={`Add for ${who?.name || "them"}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
            >
              <ArrowUp size={18} strokeWidth={2.6} />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="options"
            className="cc-composer-options"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="cc-composer-inner">
              <PeoplePicker people={people} value={assignee} onChange={setAssignee} label="For" />
              <div className="cc-composer-due">
                <div className="cc-chips" role="radiogroup" aria-label="Due">
                  {dueChoices(today).map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      role="radio"
                      aria-checked={due === choice.value}
                      aria-pressed={due === choice.value}
                      className="cc-chip cc-chip-sm"
                      onClick={() => setDue(choice.value)}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="cc-btn cc-btn-quiet cc-btn-sm" onClick={() => onMore({ title: title.trim(), assignee_email: assignee, due_on: due })}>
                  <SlidersHorizontal size={14} aria-hidden="true" /> More
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
