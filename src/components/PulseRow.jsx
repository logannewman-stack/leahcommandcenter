import React, { useState } from "react";
import { CheckCircle2, Mail, Undo2 } from "lucide-react";
import { Badge, IconTile } from "@/components/ui";
import { callAdmin } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { kindOf } from "@/lib/kinds";
import { useLive } from "@/lib/live";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { feedLine } from "@/lib/words";

/**
 * One moment, as a row: the kind's tile, who and what, when, and the
 * kind's badge. A quiet one (a cancel, a trial ending) carries Handled and,
 * for an admin, the member's address for a personal note: asked of the
 * server on the tap, shown to that admin only, never on the row itself.
 */
export default function PulseRow({ event, onChange }) {
  const { me } = useSession();
  const { refreshCounts } = useLive();
  const kind = kindOf(event.kind);
  const { title, body } = feedLine(event);
  const quiet = Boolean(event.quiet);
  const handled = Boolean(event.handled_at);
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const mark = async (undo) => {
    setBusy(true);
    setNote("");
    const { error } = await supabase.rpc("cc_mark_handled", { event_id: event.id, undo });
    setBusy(false);
    if (error) return setNote(error.message);
    onChange?.(event.id, { handled_at: undo ? null : new Date().toISOString(), handled_by: undo ? null : me?.email });
    refreshCounts();
  };

  const reach = async () => {
    setBusy(true);
    setNote("");
    try {
      setContact(await callAdmin("member", { query: { id: event.user_id } }));
    } catch (error) {
      setNote(error.status === 403 ? "Admins can ask for a member's address." : error.status === 404 ? "No account found for this moment." : error.message);
    }
    setBusy(false);
  };

  return (
    <div className="cc-row" style={{ alignItems: "flex-start", opacity: handled ? 0.7 : 1 }}>
      <IconTile icon={kind.icon} tone={handled ? "ink" : kind.tone} size={34} />
      <div className="cc-row-main">
        <div className="flex items-baseline justify-between gap-3">
          <p className="t-sub t-strong cc-label" style={{ lineHeight: 1.3 }}>
            {title}
          </p>
          <time className="t-cap1 cc-tertiary" style={{ flexShrink: 0 }} dateTime={event.occurred_at} title={new Date(event.occurred_at).toLocaleString()}>
            {timeAgo(event.occurred_at)}
          </time>
        </div>
        {body ? (
          <p className="t-foot cc-secondary" style={{ marginTop: 1 }}>
            {body}
          </p>
        ) : null}
        {quiet ? (
          <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 8 }}>
            {handled ? (
              <>
                <span className="t-cap1 cc-tertiary">Handled{event.handled_by ? ` by ${String(event.handled_by).split("@")[0]}` : ""}.</span>
                <button type="button" className="cc-btn cc-btn-quiet cc-btn-sm" onClick={() => mark(true)} disabled={busy}>
                  <Undo2 size={13} aria-hidden="true" /> Undo
                </button>
              </>
            ) : (
              <>
                <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => mark(false)} disabled={busy}>
                  <CheckCircle2 size={14} aria-hidden="true" /> Handled
                </button>
                {event.user_id && me?.is_admin && !contact ? (
                  <button type="button" className="cc-btn cc-btn-quiet cc-btn-sm" onClick={reach} disabled={busy}>
                    <Mail size={14} aria-hidden="true" /> Send a personal note
                  </button>
                ) : null}
              </>
            )}
            {contact ? (
              <a
                className="t-cap1 cc-label"
                style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
                href={`mailto:${contact.email}?subject=${encodeURIComponent(`A note from The Practice, ${contact.first_name}`)}`}
              >
                Email {contact.first_name} ({contact.email})
              </a>
            ) : null}
            {note ? <span className="t-cap1" style={{ color: "var(--cc-alert)" }}>{note}</span> : null}
          </div>
        ) : null}
      </div>
      <span className="cc-pulse-badge" style={{ alignSelf: "center" }}>
        <Badge tone={handled ? "ink" : kind.tone}>{handled ? "Handled" : kind.label}</Badge>
      </span>
    </div>
  );
}
