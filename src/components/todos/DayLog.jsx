import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, NotebookPen, X } from "lucide-react";
import { Card, Monogram } from "@/components/ui";
import { clock } from "@/lib/kinds";
import { useLogs } from "@/lib/teamData";
import { useToast } from "@/lib/toast";

const SPRING = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 };

/**
 * "What I got done today": one line at a time, beyond the to-dos (a call
 * that went well, a post that went up, a member who got an answer). Each
 * person writes their own; whoever gives out the to-dos reads everyone's,
 * live, filtered to the person she is looking at.
 */
export default function DayLog({ email, lead, who = "all", personOf, today, isAdmin }) {
  const { logs, loading, add, remove } = useLogs(today);
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = lead ? (who === "all" ? logs : logs.filter((l) => l.email === who)) : logs.filter((l) => l.email === email);
  const writers = new Set(logs.map((l) => l.email)).size;
  const focus = lead && who !== "all" ? personOf(who) : null;
  const title = lead ? (focus ? `${focus.name}'s day` : "What the team got done") : "What you got done today";
  const caption = lead && !focus ? (writers ? `${writers} ${writers === 1 ? "person" : "people"} logged` : undefined) : shown.length ? `${shown.length} logged` : undefined;

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const failed = await add(text, today);
    setBusy(false);
    if (failed) return toast({ title: "That didn't save", body: failed, tone: "rust" });
    setText("");
  };

  const takeBack = async (id) => {
    const failed = await remove(id);
    if (failed) toast({ title: "That didn't come off", body: failed, tone: "rust" });
  };

  return (
    <Card title={title} caption={caption}>
      {!focus || focus.email === email ? (
        <form className="cc-composer cc-glass" onSubmit={submit} style={{ marginBottom: 8 }}>
          <div className="cc-composer-line">
            <span className="cc-composer-plus" aria-hidden="true">
              <NotebookPen size={15} strokeWidth={2.4} />
            </span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Log something you got done" aria-label="Something you got done today" maxLength={500} enterKeyHint="send" />
            <AnimatePresence initial={false}>
              {text.trim() ? (
                <motion.button
                  key="send"
                  type="submit"
                  className="cc-composer-send"
                  aria-label="Log it"
                  disabled={busy}
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
        </form>
      ) : null}

      {loading ? null : shown.length ? (
        <div className="cc-rows">
          <AnimatePresence initial={false}>
            {shown.map((line) => {
              const person = personOf(line.email);
              const mine = line.email === email;
              return (
                <motion.div
                  key={line.id}
                  layout="position"
                  transition={SPRING}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
                  className="cc-row"
                  style={{ minHeight: 50, alignItems: "flex-start", paddingTop: 10, paddingBottom: 10 }}
                >
                  {lead && !focus ? <Monogram name={person.name} tone={person.tone} size={28} /> : <span className="cc-live-dot" style={{ marginTop: 7, flexShrink: 0 }} aria-hidden="true" />}
                  <span className="cc-row-main">
                    <span className="t-sub cc-label" style={{ display: "block", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {line.body}
                    </span>
                    <span className="t-cap1 cc-tertiary" style={{ display: "block", marginTop: 2 }}>
                      {lead && !focus ? `${person.name} · ` : ""}
                      {clock(line.created_at)}
                    </span>
                  </span>
                  {mine || isAdmin ? (
                    <button type="button" className="cc-icon-press" onClick={() => takeBack(line.id)} aria-label="Take it off the log" title="Take it off">
                      <X size={15} />
                    </button>
                  ) : null}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <p className="t-foot cc-tertiary" style={{ padding: "4px 0 8px" }}>
          {lead
            ? focus
              ? `${focus.name} hasn't logged anything yet today.`
              : "As the team logs what they got done, it lands here, live."
            : "The calls, the posts, the answers that aren't on a to-do. Leah sees each one the moment you log it."}
        </p>
      )}
    </Card>
  );
}
