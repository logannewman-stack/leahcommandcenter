import React, { useState } from "react";
import { CheckCircle2, Clock, Gift, Handshake, HeartHandshake, Mail, Megaphone, ShoppingBag, Sparkles, Trophy, UserPlus, Undo2 } from "lucide-react";
import { callAdmin } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { feedLine } from "@/lib/words";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

const ICONS = {
  join: UserPlus,
  upgrade: Sparkles,
  merch: ShoppingBag,
  gift: Gift,
  trial_ending: Clock,
  cancel: HeartHandshake,
  referral: Handshake,
  checkoff: CheckCircle2,
  shoutout: Megaphone,
  milestone: Trophy
};

/**
 * One moment on the board. A quiet card (a cancel, a trial ending) carries
 * two things the loud ones do not: Handled, and for an admin, the member's
 * address to write a personal note to. The address is asked for on the tap
 * and shown to that admin only; it is never on the row.
 */
export default function PulseCard({ event, onChange }) {
  const { me } = useSession();
  const Icon = ICONS[event.kind] || Sparkles;
  const { title, body } = feedLine(event);
  const quiet = Boolean(event.quiet);
  const handled = Boolean(event.handled_at);
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const mark = async (undo) => {
    setBusy(true);
    const { error } = await supabase.rpc("cc_mark_handled", { event_id: event.id, undo });
    setBusy(false);
    if (error) setNote(error.message);
    else onChange?.(event.id, { handled_at: undo ? null : new Date().toISOString(), handled_by: undo ? null : me?.email });
  };

  const reach = async () => {
    setBusy(true);
    setNote("");
    try {
      setContact(await callAdmin("member", { query: { id: event.user_id } }));
    } catch (error) {
      setNote(error.status === 403 ? "Admins can ask for a member's address." : error.status === 404 ? "No account found for this card." : error.message);
    }
    setBusy(false);
  };

  return (
    <article
      className={`card p-4 flex gap-3 animate-rise-in ${event.big ? "ambient-gold border-gilt/60" : ""} ${quiet ? "bg-canvas-sunken/60" : ""} ${handled ? "opacity-70" : ""}`}
    >
      <span
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          quiet ? "bg-surface border border-line text-ink-faint" : event.big ? "bg-feature text-gilt" : "bg-accent/12 text-accent"
        }`}
        aria-hidden="true"
      >
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[17px] leading-tight text-ink truncate">{title}</h3>
          <time className="shrink-0 text-xs text-ink-faint" dateTime={event.occurred_at} title={new Date(event.occurred_at).toLocaleString()}>
            {timeAgo(event.occurred_at)}
          </time>
        </div>
        {body ? <p className="mt-0.5 text-[14px] leading-snug text-ink-muted">{body}</p> : null}
        {quiet ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {handled ? (
              <>
                <span className="text-xs text-ink-faint">Handled{event.handled_by ? ` by ${String(event.handled_by).split("@")[0]}` : ""}.</span>
                <button type="button" className="btn-quiet !py-1 !px-2.5 text-xs" onClick={() => mark(true)} disabled={busy}>
                  <Undo2 size={13} /> Undo
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => mark(false)} disabled={busy}>
                  <CheckCircle2 size={14} /> Handled
                </button>
                {event.user_id && me?.is_admin && !contact ? (
                  <button type="button" className="btn-quiet !py-1.5 !px-3 text-xs" onClick={reach} disabled={busy}>
                    <Mail size={14} /> Send a personal note
                  </button>
                ) : null}
              </>
            )}
            {contact ? (
              <a
                className="text-xs text-accent underline underline-offset-2"
                href={`mailto:${contact.email}?subject=${encodeURIComponent(`A note from The Practice, ${contact.first_name}`)}`}
              >
                Email {contact.first_name} ({contact.email})
              </a>
            ) : null}
            {note ? <span className="text-xs text-danger">{note}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
