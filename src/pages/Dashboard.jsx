import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar, CheckCircle2, Clock, Gift, Heart, HeartHandshake, ListChecks, MailWarning, MinusCircle, Package, PenLine, Plug,
  Send, ShoppingBag, Sparkles, TrendingUp, UserPlus, Users
} from "lucide-react";
import { NAV_ICONS } from "@/components/Shell";
import { TeamTodayCard, YourTodosCard } from "@/components/todos/TodoCards";
import Sparkline from "@/components/Sparkline";
import { Badge, Card, CountPill, EmptyLine, IconTile, LinkRow, Notice, Page, RefreshButton, Segmented, Skeleton, StatCard } from "@/components/ui";
import { callAdmin } from "@/lib/api";
import { money, percent } from "@/lib/format";
import { clock, kindOf } from "@/lib/kinds";
import { updatedLabel, useLive, useTick, useWide } from "@/lib/live";
import { NAV_ITEMS, badgeCount } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useTasks } from "@/lib/tasksStore";
import { PERIODS, PERIOD_COPY, intervals, isToday, series, startOfDay } from "@/lib/trends";
import { STEPS, whoOf } from "@/lib/words";

/*
 * The Dashboard answers "what needs me" first, as the Detail on Demand
 * Command Center's does: the hero strip, then Needs you (the same counts the
 * sidebar badges show) beside Today, then the trends with one range for
 * every tile, then the numbers that are what they are right now.
 */

const SERIES_STEPS = new Set(STEPS.filter((s) => s.on === "join").map((s) => s.id));
const THANKS_STEPS = new Set(["upgrade", "merch_order"]);
const MIN_SPIN_MS = 700;

const todayLabel = (now) => now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the server says is not connected yet: the keys every Phase 1 piece needs. */
function missingFrom(health) {
  if (!health) return 0;
  return [health.database, health.stripe?.key, health.stripe?.webhook_secret, health.email, health.discord, health.cron?.secret].filter((ok) => !ok).length;
}

export default function Dashboard() {
  const { counts, subscribe } = useLive();
  const { me } = useSession();
  const { lead, overdue } = useTasks();
  const wide = useWide();
  useTick(30_000);
  const [score, setScore] = useState(null);
  const [events, setEvents] = useState([]);
  const [sends, setSends] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState("");
  const [at, setAt] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [period, setPeriod] = useState("weekly");

  const load = useCallback(async () => {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
    const dayStart = startOfDay(now).toISOString();
    const [s, e, j] = await Promise.all([
      supabase.rpc("cc_scoreboard"),
      supabase
        .from("cc_pulse_events")
        .select("id, kind, occurred_at, first_name, city, detail, big, quiet, handled_at, user_id")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(5000),
      supabase.from("cc_journey").select("id, step, channel, status, due_at").gte("due_at", dayStart).lte("due_at", now.toISOString()).neq("status", "due").limit(2000)
    ]);
    if (!s.error) setScore(s.data);
    if (!e.error) setEvents(e.data || []);
    if (!j.error) setSends(j.data || []);
    setProblem(s.error || e.error ? (s.error || e.error).message : "");
    setAt(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A new moment lands on Today and the trends at once; the numbers re-read.
  useEffect(
    () =>
      subscribe((type, row) => {
        if (type === "insert") {
          setEvents((now) => [row, ...now.filter((event) => event.id !== row.id)]);
          supabase.rpc("cc_scoreboard").then(({ data }) => data && setScore(data));
        } else setEvents((now) => now.map((event) => (event.id === row.id ? { ...event, ...row } : event)));
        setAt(Date.now());
      }),
    [subscribe]
  );

  useEffect(() => {
    if (!me?.is_admin) return;
    callAdmin("health")
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [me?.is_admin]);

  const refresh = async () => {
    setSpinning(true);
    const started = Date.now();
    await load();
    const left = MIN_SPIN_MS - (Date.now() - started);
    if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
    setSpinning(false);
  };

  const now = new Date();
  const s = score || {};
  const waitingCopy = STEPS.filter((step) => !step.enabled).length;

  const needs = [
    { key: "overdue", count: lead ? overdue : 0, icon: ListChecks, tone: "amber", to: "/todos", title: "To-dos past their day", sub: "Across the team · a nudge can help" },
    { key: "cancels", count: counts.cancels, icon: HeartHandshake, tone: "rust", to: "/pulse?view=needs", title: "Cancellations to reach out to", sub: "A personal note from someone on the team" },
    { key: "trials", count: counts.trialsEnding, icon: Clock, tone: "amber", to: "/pulse?view=needs", title: "Trials ending in 48 hours", sub: "A good moment for someone to reach out" },
    { key: "failed", count: counts.journeyFailed, icon: MailWarning, tone: "rust", to: "/journey?status=failed", title: "Welcome messages that didn't send", sub: "Last 14 days · the reason is on the Journey" },
    { key: "copy", count: waitingCopy, icon: PenLine, tone: "plum", to: "/journey", title: "Journey steps waiting on Leah's copy", sub: "Planned, and never sent until the words are in" },
    { key: "setup", count: missingFrom(health), icon: Plug, tone: "navy", to: "/setup", title: "Connections not set up yet", sub: "Stripe, email, Discord and the hourly job" }
  ].filter((row) => row.count > 0);

  const sent = sends.filter((row) => row.status === "sent");
  const handled = [
    { key: "welcomes", count: sent.filter((row) => SERIES_STEPS.has(row.step)).length, icon: Send, tone: "green", to: "/journey?status=sent", title: "Welcome messages sent", sub: "Email, text and in app, as each step came due" },
    { key: "thanks", count: sent.filter((row) => THANKS_STEPS.has(row.step)).length, icon: Heart, tone: "gold", to: "/journey?status=sent", title: "Thank-you emails sent", sub: "For an upgrade or a merch order" },
    { key: "flagged", count: events.filter((e) => e.kind === "trial_ending" && isToday(e.occurred_at, now)).length, icon: Clock, tone: "amber", to: "/pulse?view=needs", title: "Trials flagged 48 hours out", sub: "Put on the board for someone to reach out" },
    { key: "skipped", count: sends.filter((row) => row.status === "skipped").length, icon: MinusCircle, tone: "ink", to: "/journey?status=skipped", title: "Steps skipped, with the reason", sub: "No opt-in for a text, no longer a member, copy not in yet" }
  ].filter((row) => row.count > 0);

  const today = useMemo(() => events.filter((e) => isToday(e.occurred_at, now)), [events, now.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = PERIOD_COPY[period];
  const trends = useMemo(() => {
    const buckets = intervals(period, new Date());
    const of = (kind) => events.filter((e) => e.kind === kind);
    const when = (e) => e.occurred_at;
    const cents = (e) => Number(e.detail?.amount_cents) || 0;
    return [
      { key: "trials", title: "New trials", icon: UserPlus, tone: "navy", data: series(buckets, of("join"), when) },
      { key: "upgrades", title: "Upgrades", icon: Sparkles, tone: "gold", data: series(buckets, of("upgrade"), when) },
      { key: "merch", title: "Merch sales", icon: ShoppingBag, tone: "green", type: "area", money: true, data: series(buckets, of("merch"), when, cents) },
      { key: "orders", title: "Merch orders", icon: Package, tone: "green", data: series(buckets, of("merch"), when) },
      { key: "gifts", title: "Gifts", icon: Gift, tone: "plum", data: series(buckets, of("gift"), when) },
      { key: "cancels", title: "Cancellations", icon: HeartHandshake, tone: "rust", data: series(buckets, of("cancel"), when) }
    ];
  }, [events, period]);

  const subtitle = [todayLabel(now), updatedLabel(at)].filter(Boolean).join(" · ");
  const needYou = (counts.cancels || 0) + (counts.trialsEnding || 0);

  return (
    <Page title="Dashboard" subtitle={subtitle} right={<RefreshButton busy={spinning} onClick={refresh} />}>
      {loading ? (
        <div className="cc-stack" aria-hidden="true">
          <Skeleton height={96} />
          <div className="cc-grid-2">
            <Skeleton height={236} />
            <Skeleton height={236} />
          </div>
          <div className="cc-grid-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={168} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* The hero strip: the three numbers that say how today is going */}
          <div className="cc-hero cc-rise" role="group" aria-label="At a glance">
            <div className="cc-hero-stat">
              <div className="cc-hero-value">{score ? s.active_paying ?? 0 : "–"}</div>
              <div className="cc-hero-label">Paying members</div>
            </div>
            <div className="cc-hero-rule" />
            <div className="cc-hero-stat">
              <div className="cc-hero-value">{score ? s.trials_week ?? 0 : "–"}</div>
              <div className="cc-hero-label">New trials this week</div>
            </div>
            <div className="cc-hero-rule" />
            <div className="cc-hero-stat">
              <div className={`cc-hero-value ${needYou > 0 ? "is-alert" : ""}`}>{counts.known ? needYou : "–"}</div>
              <div className="cc-hero-label">Members to reach</div>
            </div>
          </div>

          {/* The to-dos: everyone's own list, and Leah's view of the team's day */}
          <div className="cc-grid-2">
            {lead ? <TeamTodayCard /> : null}
            <div style={lead ? undefined : { gridColumn: "1 / -1" }}>
              <YourTodosCard />
            </div>
          </div>

          {problem ? (
            <Notice icon={Plug} title="Some numbers can't be read yet">
              The Command Center's tables aren't answering ({problem}). Until the migration has run on the Practice's database, numbers show a dash instead of 0.
            </Notice>
          ) : null}

          {/* What needs me, and today: side by side beside the sidebar, stacked on a phone */}
          <div className="cc-grid-2">
            <div className="cc-stack">
              <Card title="Needs you">
                {needs.length === 0 ? (
                  <EmptyLine icon={CheckCircle2} tone="green" title="Nothing needs you right now." sub="Cancellations, trials ending and the Welcome Journey are clear." />
                ) : (
                  <div className="cc-rows">
                    {needs.map((row) => (
                      <LinkRow key={row.key} {...row} />
                    ))}
                  </div>
                )}
              </Card>
              <Card title="Handled automatically today" caption={handled.length ? "Nothing to do" : undefined}>
                {handled.length === 0 ? (
                  <EmptyLine title="Nothing has gone out yet today." sub="Welcome messages, thank-yous and trial reminders are sent here as they come due." />
                ) : (
                  <div className="cc-rows">
                    {handled.map((row) => (
                      <LinkRow key={row.key} {...row} countQuiet />
                    ))}
                  </div>
                )}
              </Card>
            </div>
            <Card title="Today" caption={today.length ? plural(today.length, "moment") : undefined}>
              {today.length === 0 ? (
                <EmptyLine icon={Calendar} tone="plum" title="No member moments yet today." sub="Joins, upgrades and orders land here the second Stripe says so." />
              ) : (
                <div className="cc-rows">
                  {today.slice(0, 12).map((event) => {
                    const kind = kindOf(event.kind);
                    return (
                      <Link
                        key={event.id}
                        to={event.quiet ? "/pulse?view=needs" : "/pulse"}
                        className="cc-row"
                        style={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1fr) auto", gap: 10 }}
                      >
                        <span className="t-foot" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--cc-secondary)" }}>
                          {clock(event.occurred_at)}
                        </span>
                        <span className="min-w-0">
                          <span className="t-sub t-strong cc-clip" style={{ display: "block" }}>
                            {whoOf(event)}
                          </span>
                          <span className="t-cap1 cc-tertiary cc-clip" style={{ display: "block" }}>
                            {todayLine(event)}
                          </span>
                        </span>
                        <Badge tone={event.handled_at ? "ink" : kind.tone}>{event.handled_at ? "Handled" : kind.label}</Badge>
                      </Link>
                    );
                  })}
                  {today.length > 12 ? (
                    <Link to="/pulse" className="cc-row t-foot" style={{ minHeight: 40, color: "var(--cc-secondary)", fontWeight: 600 }}>
                      {today.length - 12} more today on the Live Pulse
                    </Link>
                  ) : null}
                </div>
              )}
            </Card>
          </div>

          {/* The screens, one tap away on a phone (the sidebar has them beside it) */}
          {!wide ? (
            <section>
              <h2 className="t-eyebrow cc-tertiary" style={{ margin: "4px 4px 8px" }}>
                Screens
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 10 }}>
                {NAV_ITEMS.filter((item) => item.key !== "dashboard").map((item) => {
                  const count = badgeCount(item, counts);
                  const Icon = NAV_ICONS[item.key];
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      className="cc-glass cc-lift"
                      aria-label={count > 0 ? `${item.label}, ${count} ${item.badge.what}` : item.label}
                      style={{ display: "block", position: "relative", borderRadius: 14, padding: "12px 12px 11px", minHeight: 88, textDecoration: "none" }}
                    >
                      {count > 0 ? (
                        <span style={{ position: "absolute", top: 10, right: 10 }}>
                          <CountPill n={count} large />
                        </span>
                      ) : null}
                      <IconTile icon={Icon} tone={SCREEN_TONES[item.key]} size={28} />
                      <span className="t-foot cc-label" style={{ display: "block", fontWeight: 600, marginTop: 8 }}>
                        {item.label}
                      </span>
                      <span className="t-cap2 cc-tertiary cc-clip" style={{ display: "block", marginTop: 1 }}>
                        {item.hint}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Trends: one range for every tile, and the big number is that range's current bucket */}
          <div className="flex flex-wrap items-center" style={{ gap: "6px 16px", padding: "6px 2px 0" }}>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <h2 className="t-headline cc-label">Trends</h2>
              <p className="t-cap1 cc-tertiary" style={{ marginTop: 1 }}>
                {copy.range} · the big numbers are {copy.current.toLowerCase()}
              </p>
            </div>
            <Segmented options={PERIODS} value={period} onChange={setPeriod} label="Chart range" style={{ flex: "1 1 240px", maxWidth: 320 }} />
          </div>
          <div className="cc-grid-2">
            {trends.map((card) => (
              <TrendCard key={card.key} {...card} copy={copy} />
            ))}
          </div>

          {/* What is true right now, with its breakdown */}
          <div className="cc-grid-3">
            <StatCard
              icon={Users}
              tone="navy"
              title="Members right now"
              value={s.active_paying ?? 0}
              caption="paying"
              known={Boolean(score)}
              rows={[
                { label: "On a trial", value: s.trialing ?? 0 },
                { label: "Set to cancel", value: s.cancelling ?? 0 },
                { label: "Used the app in 7 days", value: s.active_7d ?? 0 },
                { label: "Accounts", value: s.members_total ?? 0 },
                ...(s.mrr_cents ? [{ label: "Monthly recurring", value: money(s.mrr_cents) }] : [])
              ]}
            />
            <StatCard
              icon={TrendingUp}
              tone="green"
              title="Trial to paid"
              value={percent(s.cohort_converted, s.cohort_joins)}
              caption="of trials over a week old"
              known={Boolean(score)}
              rows={[
                { label: "Trials over a week old", value: s.cohort_joins ?? 0 },
                { label: "Paying now", value: s.cohort_converted ?? 0 },
                { label: "Upgrades this month", value: s.upgrades_month ?? 0 },
                { label: "Referrals", value: "Phase 3" }
              ]}
            />
            <StatCard
              icon={ShoppingBag}
              tone="gold"
              title="Merch this month"
              value={money(s.merch_month_cents || 0)}
              caption={plural(s.merch_month_orders ?? 0, "order")}
              known={Boolean(score)}
              rows={
                Array.isArray(s.top_items) && s.top_items.length
                  ? s.top_items.slice(0, 4).map((item) => ({ label: item.name, value: `× ${item.count}` }))
                  : [{ label: "Top sellers", value: "None yet" }, { label: "Gifts this month", value: s.gifts_month ?? 0 }]
              }
            />
          </div>
        </>
      )}
    </Page>
  );
}

const SCREEN_TONES = { todos: "green", pulse: "rust", journey: "navy", team: "plum", setup: "ink" };

/** What happened, in a few words, for the Today list. */
function todayLine(event) {
  const d = event.detail || {};
  switch (event.kind) {
    case "join":
      return d.trial === false ? "Joined as a full member" : "Started the 7 day trial";
    case "upgrade":
      return `Upgraded${d.plan === "year" ? ", by the year" : ""}`;
    case "merch": {
      const items = Array.isArray(d.items) ? d.items.map((i) => i.name).filter(Boolean) : [];
      return [items.join(", ") || "A merch order", d.amount_cents ? money(d.amount_cents, d.currency) : ""].filter(Boolean).join(" · ");
    }
    case "gift":
      return d.item || "A gift purchase";
    case "trial_ending":
      return "Trial ends in 48 hours";
    case "cancel":
      return d.at_period_end ? "Set to cancel at the end of the period" : "Membership ended";
    default:
      return d.title || "";
  }
}

/** A trend tile: the current bucket's number, the chart, and the range's two ends. */
function TrendCard({ title, icon, tone, type = "bar", money: isMoney, data, copy }) {
  const fmt = isMoney ? (value) => money(value) : (value) => Number(value).toLocaleString("en-US");
  const current = data[data.length - 1]?.value ?? 0;
  const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0] || { value: 0, label: "" });
  const summary = `${title} by ${copy.unit}, ${copy.range.toLowerCase()}: ${copy.current.toLowerCase()} ${fmt(current)}, highest ${fmt(peak.value)} (${peak.label}).`;
  return (
    <div className={`cc-glass tone-${tone}`} style={{ borderRadius: 16, padding: "15px 14px 10px" }}>
      <div className="flex items-center" style={{ gap: 11, marginBottom: 10 }}>
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0">
          <p className="t-num cc-label" style={{ fontSize: 26, lineHeight: "30px" }}>
            {fmt(current)}
          </p>
          <h3 className="t-eyebrow cc-tertiary" style={{ marginTop: 2 }}>
            {title}
          </h3>
        </div>
        <p className="t-cap1 cc-tertiary" style={{ marginLeft: "auto", alignSelf: "flex-start", whiteSpace: "nowrap" }}>
          {copy.current}
        </p>
      </div>
      <div role="img" aria-label={summary}>
        <Sparkline data={data} type={type} height={80} />
      </div>
      <div aria-hidden="true" className="flex justify-between" style={{ marginTop: 4 }}>
        <span className="t-cap2 cc-tertiary">{data[0]?.label}</span>
        <span className="t-cap2 cc-tertiary">{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
