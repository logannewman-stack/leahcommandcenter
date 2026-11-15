import React, { useEffect, useState } from "react";
import { Crown, ListChecks, Mail, PenLine, Plus, Send, Trash2, UserPlus, Users, X } from "lucide-react";
import { Badge, Card, EmptyState, Monogram, Page, Sheet, Switch } from "@/components/ui";
import { callAdmin } from "@/lib/api";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

const TONES = ["navy", "plum", "green", "amber", "gold", "rust"];
const BLANK = { email: "", name: "", lane: "", responsibilities: [], is_admin: false, assigns_tasks: false, active: true };
const looksLikeEmail = (value) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(String(value || "").trim());

function Toggle({ title, sub, checked, onChange, disabled }) {
  return (
    <div className="cc-row" style={{ minHeight: 54, padding: 0 }}>
      <span className="cc-row-main">
        <span className="t-sub t-strong cc-label" style={{ display: "block" }}>
          {title}
        </span>
        <span className="t-cap1 cc-tertiary" style={{ display: "block" }}>
          {sub}
        </span>
      </span>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

/** Add or change a teammate: name, lane, what they own, and what they can do. */
function PersonSheet({ open, onClose, person, isSelf, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(BLANK);
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const adding = !person;
  useEffect(() => {
    if (!open) return;
    setForm(person ? { ...BLANK, ...person, responsibilities: person.responsibilities || [] } : BLANK);
    setItem("");
    setConfirm(false);
  }, [open, person]);
  const set = (patch) => setForm((now) => ({ ...now, ...patch }));
  const addItem = () => {
    const text = item.trim();
    if (!text) return;
    if (!form.responsibilities.includes(text)) set({ responsibilities: [...form.responsibilities, text].slice(0, 12) });
    setItem("");
  };

  const save = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim()) return toast({ title: "Their first name", tone: "amber" });
    if (adding && !looksLikeEmail(email)) return toast({ title: "The email they sign in with", body: "The same one as their Practice account or Google.", tone: "amber" });
    const pending = item.trim() && !form.responsibilities.includes(item.trim()) ? [...form.responsibilities, item.trim()] : form.responsibilities;
    const row = {
      name: form.name.trim(),
      lane: form.lane.trim() || null,
      responsibilities: pending,
      is_admin: Boolean(form.is_admin),
      assigns_tasks: Boolean(form.assigns_tasks),
      active: Boolean(form.active)
    };
    setBusy(true);
    const { error } = adding ? await supabase.from("cc_team").insert({ email, ...row }) : await supabase.from("cc_team").update(row).eq("email", person.email);
    setBusy(false);
    if (error) {
      const taken = /duplicate|unique/i.test(error.message);
      return toast({ title: taken ? "They're already on the team" : "That didn't save", body: taken ? undefined : error.message, tone: "rust" });
    }
    toast({ title: adding ? `${row.name} is on the team` : `${row.name}, saved`, body: adding ? "Tap “Send a sign-in link” on their card next." : undefined, icon: adding ? UserPlus : PenLine, tone: "green" });
    await onSaved();
    onClose();
  };

  const remove = async () => {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    const { error } = await supabase.from("cc_team").delete().eq("email", person.email);
    setBusy(false);
    if (error) return toast({ title: "That didn't come off", body: error.message, tone: "rust" });
    toast({ title: `${person.name} is off the team`, tone: "navy" });
    await onSaved();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={adding ? "Add a teammate" : `${person?.name || ""}`}
      footer={
        <>
          {!adding && !isSelf ? (
            <button type="button" className="cc-btn cc-btn-quiet cc-btn-danger" onClick={remove} disabled={busy} style={{ marginRight: "auto" }}>
              <Trash2 size={15} /> {confirm ? "Tap again to remove" : "Remove"}
            </button>
          ) : null}
          <button type="button" className="cc-btn cc-btn-primary" onClick={save} disabled={busy}>
            {adding ? "Add to the team" : "Save"}
          </button>
        </>
      }
    >
      <div className="cc-form">
        <label className="block">
          <p className="cc-form-label">First name</p>
          <input className="cc-input cc-input-title" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Clint" maxLength={40} autoFocus={adding} />
        </label>
        <label className="block">
          <p className="cc-form-label">The email they sign in with</p>
          <input
            className="cc-input"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="name@example.com"
            disabled={!adding}
            title={adding ? undefined : "To change someone's email, remove them and add them again."}
          />
        </label>
        <label className="block">
          <p className="cc-form-label">Lane</p>
          <input className="cc-input" value={form.lane || ""} onChange={(e) => set({ lane: e.target.value })} placeholder="Member care, Discord, Brand…" maxLength={40} />
        </label>
        <div>
          <p className="cc-form-label">What they own</p>
          {form.responsibilities.length ? (
            <div className="cc-chips" style={{ marginBottom: 10 }}>
              {form.responsibilities.map((r) => (
                <button key={r} type="button" className="cc-chip cc-chip-sm" onClick={() => set({ responsibilities: form.responsibilities.filter((x) => x !== r) })} aria-label={`Remove ${r}`}>
                  {r} <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              className="cc-input"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="Answers member questions within a day"
              maxLength={80}
              aria-label="Add something they own"
            />
            <button type="button" className="cc-btn" onClick={addItem} aria-label="Add it">
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="cc-rows">
          <Toggle title="Gives out to-dos" sub="Sees and edits everyone's list" checked={Boolean(form.assigns_tasks)} onChange={(on) => set({ assigns_tasks: on })} />
          <Toggle title="Admin" sub="Edits the team, the settings and the Dream Board" checked={Boolean(form.is_admin)} onChange={(on) => set({ is_admin: on })} disabled={isSelf} />
          <Toggle title="Can sign in" sub="Off pauses their access without removing them" checked={Boolean(form.active)} onChange={(on) => set({ active: on })} disabled={isSelf} />
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Roles: who owns what, so nobody has to ask who handles a member question,
 * a refund or a Discord post. An admin adds teammates, edits their lane and
 * what they own, decides who gives out the to-dos, and sends a one-time
 * sign-in link.
 */
export default function Team() {
  const { team, me, refresh } = useSession();
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(null);
  const admin = Boolean(me?.is_admin);
  const people = admin ? team : team.filter((person) => person.active !== false);

  const setLead = async (person, on) => {
    setBusy(person.email);
    const { error } = await supabase.from("cc_team").update({ assigns_tasks: on }).eq("email", person.email);
    setBusy("");
    if (error) toast({ title: "That didn't save", body: error.message, tone: "rust" });
    else {
      toast({ title: on ? `${person.name} gives out to-dos` : `${person.name} sees only their own to-dos`, icon: ListChecks, tone: "navy" });
      refresh();
    }
  };

  const invite = async (person) => {
    setBusy(`invite:${person.email}`);
    try {
      await callAdmin("invite", { method: "POST", body: { email: person.email } });
      toast({ title: `Sign-in link sent to ${person.name}`, body: `It's in ${person.email}. One tap and they're in.`, icon: Mail, tone: "green" });
    } catch (error) {
      // No email key on the server yet: Supabase's own sign-in email does the same job.
      if (error.status === 503) {
        const { error: otp } = await supabase.auth.signInWithOtp({ email: person.email, options: { emailRedirectTo: window.location.origin, shouldCreateUser: true } });
        if (otp) toast({ title: "That didn't send", body: otp.message, tone: "rust" });
        else toast({ title: `Sign-in link sent to ${person.name}`, body: `It's in ${person.email}.`, icon: Mail, tone: "green" });
      } else toast({ title: "That didn't send", body: error.message, tone: "rust" });
    }
    setBusy("");
  };

  return (
    <Page
      title="Roles"
      subtitle={`${people.filter((p) => p.active !== false).length} on the team · who owns what`}
      right={
        admin ? (
          <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => setEditing({})}>
            <UserPlus size={15} /> Add a teammate
          </button>
        ) : null
      }
    >
      {people.length ? (
        <div className="cc-grid-3">
          {people.map((person, i) => {
            const tone = TONES[i % TONES.length];
            const paused = person.active === false;
            return (
              <Card key={person.email} className={paused ? "opacity-60" : ""}>
                <div className="flex items-center" style={{ gap: 12, marginBottom: 8 }}>
                  <Monogram name={person.name} tone={tone} size={44} />
                  <div className="min-w-0" style={{ flex: 1 }}>
                    <p className="t-headline cc-label cc-clip">
                      {person.name}
                      {person.email === me?.email ? <span className="t-cap1 cc-tertiary"> · you</span> : null}
                    </p>
                    <p className="t-foot cc-tertiary cc-clip">{paused ? "Paused" : person.lane || "No lane yet"}</p>
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    {person.is_admin ? (
                      <Badge tone="gold" title="Can change settings and see a member's address">
                        Admin
                      </Badge>
                    ) : null}
                    {person.assigns_tasks ? (
                      <Badge tone="green" title="Gives out the to-dos and sees all of them">
                        To-dos
                      </Badge>
                    ) : null}
                  </span>
                  {admin ? (
                    <button type="button" className="cc-icon-press" onClick={() => setEditing(person)} aria-label={`Edit ${person.name}`} title="Edit">
                      <PenLine size={16} />
                    </button>
                  ) : null}
                </div>
                {(person.responsibilities || []).length ? (
                  <ul className="cc-rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {person.responsibilities.map((item) => (
                      <li key={item} className="t-foot cc-secondary flex items-center gap-2" style={{ padding: "7px 0" }}>
                        <span className={`tone-${tone}`} style={{ width: 6, height: 6, borderRadius: 3, background: "var(--tone)", flexShrink: 0 }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="t-foot cc-tertiary" style={{ padding: "6px 0" }}>
                    {admin ? (
                      <button type="button" className="cc-link-button" style={{ minHeight: 0, padding: 0 }} onClick={() => setEditing(person)}>
                        Add what {person.name} owns
                      </button>
                    ) : (
                      "No responsibilities listed yet."
                    )}
                  </p>
                )}
                {admin ? (
                  <>
                    <div className="cc-row" style={{ minHeight: 48, marginTop: 4, boxShadow: "inset 0 0.5px 0 var(--cc-hair)" }}>
                      <span className="cc-row-main">
                        <span className="t-foot t-strong cc-label" style={{ display: "block" }}>
                          Gives out to-dos
                        </span>
                        <span className="t-cap1 cc-tertiary" style={{ display: "block" }}>
                          Sees everyone's list
                        </span>
                      </span>
                      <Switch checked={Boolean(person.assigns_tasks)} disabled={busy === person.email} onChange={(on) => setLead(person, on)} label={`${person.name} gives out to-dos`} />
                    </div>
                    {person.email !== me?.email && !paused ? (
                      <button
                        type="button"
                        className="cc-btn cc-btn-quiet cc-btn-sm"
                        style={{ width: "100%", marginTop: 6 }}
                        onClick={() => invite(person)}
                        disabled={busy === `invite:${person.email}`}
                      >
                        <Send size={14} /> {busy === `invite:${person.email}` ? "Sending…" : "Send a sign-in link"}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Users} title="No team yet." sub="Add the team in Supabase with supabase/seed-team.sql, then sign in again." />
        </Card>
      )}
      <p className="t-cap1 cc-tertiary flex items-center gap-2" style={{ padding: "0 4px" }}>
        <Crown size={13} aria-hidden="true" />
        {admin
          ? "Add someone with the email they'll sign in with, then send them a link. Whoever gives out to-dos sees every list; everyone else sees their own."
          : "Whoever gives out to-dos sees every list; everyone else sees their own."}
      </p>

      <PersonSheet
        open={Boolean(editing)}
        person={editing?.email ? editing : null}
        isSelf={editing?.email === me?.email}
        onSaved={refresh}
        onClose={() => setEditing(null)}
      />
    </Page>
  );
}
