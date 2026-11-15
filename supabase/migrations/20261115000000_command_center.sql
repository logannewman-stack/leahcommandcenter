-- ═══════════════════════════════════════════════════════════════════════════
-- The Practice Command Center — Phase 1
--
-- Everything the Command Center adds to the Practice app's database. Every
-- table is prefixed `cc_`, so nothing here can be mistaken for the app's own.
-- Run it in the Supabase SQL editor of the Practice app's project (or
-- `supabase db push` with the CLI linked to it). Safe to run more than once.
--
-- ── One gate ─────────────────────────────────────────────────────────────
-- `cc_is_team()`: the signed-in person's email is on `cc_team`. That is the
-- whole authorization model. A team member reads the Command Center's own
-- tables; only the server, with the service key, writes them. A member of
-- the Practice who is not on the team sees nothing — not a row, not a count.
--
-- ── What is deliberately not here ────────────────────────────────────────
-- No policy on any of the app's own tables changes. The team still cannot
-- read a member's routine entries, coach messages, wins or journal: the
-- Command Center's server reads `profiles` and `memberships` for a first
-- name and a status, and `practice_days` for counts, and nothing else.
-- `cc_pulse_events` carries a first name and a city, never an email.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The team ────────────────────────────────────────────────────────────────

create table if not exists public.cc_team (
  email            text primary key check (email = lower(email) and position('@' in email) > 1),
  name             text not null,
  -- The lane on the roles page: "Founder", "Member care", "Discord", …
  lane             text,
  responsibilities text[] not null default '{}',
  is_admin         boolean not null default false,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.cc_team is
  'Who may open the Command Center, by the email they sign in with. Admins '
  'may edit the team and the settings, and ask the server for a member''s '
  'contact details to send a personal note.';

create or replace function public.cc_is_team()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cc_team t
     where t.active
       and t.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

create or replace function public.cc_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cc_team t
     where t.active and t.is_admin
       and t.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

revoke all on function public.cc_is_team() from public, anon;
revoke all on function public.cc_is_admin() from public, anon;
grant execute on function public.cc_is_team() to authenticated;
grant execute on function public.cc_is_admin() to authenticated;

alter table public.cc_team enable row level security;

drop policy if exists "cc_team: team reads" on public.cc_team;
create policy "cc_team: team reads" on public.cc_team
  for select using (public.cc_is_team());

drop policy if exists "cc_team: admins write" on public.cc_team;
create policy "cc_team: admins write" on public.cc_team
  for all using (public.cc_is_admin()) with check (public.cc_is_admin());

grant select, insert, update, delete on public.cc_team to authenticated;

-- ── Live Pulse ──────────────────────────────────────────────────────────────
-- One row per moment the team sees: a join, an upgrade, a merch order, a
-- gift, a trial ending, a cancel. Written only by the server, from Stripe's
-- events and the hourly job. `source_id` is the idempotency key: Stripe
-- sending an event twice is one card.

create table if not exists public.cc_pulse_events (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in (
                'join', 'upgrade', 'merch', 'gift', 'trial_ending', 'cancel',
                'referral', 'checkoff', 'shoutout', 'milestone', 'note')),
  -- Whose, for the admin view only (a personal note after a cancel). Never
  -- shown on the feed; the feed shows `first_name` and `city`.
  user_id     uuid references auth.users (id) on delete set null,
  first_name  text not null default '',
  city        text,
  -- What happened, without anybody's contact details: the plan, the items
  -- bought and the amount, the trial's end. See api/_lib/pulse.js.
  detail      jsonb not null default '{}'::jsonb,
  -- A bigger burst on the board: an upgrade, a gift, a milestone.
  big         boolean not null default false,
  -- A quiet card: a cancel, a trial ending. No sound, no burst, no Discord.
  quiet       boolean not null default false,
  source      text not null default 'stripe',
  source_id   text unique,
  -- A quiet card somebody on the team acted on.
  handled_at  timestamptz,
  handled_by  text,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists cc_pulse_events_when_idx on public.cc_pulse_events (occurred_at desc);
create index if not exists cc_pulse_events_kind_idx on public.cc_pulse_events (kind, occurred_at desc);
create index if not exists cc_pulse_events_user_idx on public.cc_pulse_events (user_id);

alter table public.cc_pulse_events enable row level security;

drop policy if exists "cc_pulse: team reads" on public.cc_pulse_events;
create policy "cc_pulse: team reads" on public.cc_pulse_events
  for select using (public.cc_is_team());

grant select on public.cc_pulse_events to authenticated;

-- The board subscribes to inserts (Supabase Realtime); the select policy above
-- is what Realtime checks before it hands a row to a subscriber.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cc_pulse_events'
  ) then
    alter publication supabase_realtime add table public.cc_pulse_events;
  end if;
end $$;

-- A quiet card, handled: the team marks it from the board. The one write a
-- team member makes to this table, through a function so nothing else on the
-- row can be changed from the browser.
create or replace function public.cc_mark_handled(event_id uuid, undo boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.cc_is_team() then
    raise exception 'not on the team' using errcode = '42501';
  end if;
  update public.cc_pulse_events
     set handled_at = case when undo then null else now() end,
         handled_by = case when undo then null else lower(coalesce(auth.jwt() ->> 'email', '')) end
   where id = event_id;
end $$;

revoke all on function public.cc_mark_handled(uuid, boolean) from public, anon;
grant execute on function public.cc_mark_handled(uuid, boolean) to authenticated;

-- ── The Welcome Journey ─────────────────────────────────────────────────────
-- One row per message per member: planned when they join (or upgrade, or
-- order), sent by the hourly job when due. `ref` tells two of the same step
-- apart (a second merch order is a second thank you). Status and a note, so
-- the Journey page can say what went and what was skipped, and why.

create table if not exists public.cc_journey (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  first_name text not null default '',
  step       text not null,
  channel    text not null check (channel in ('email', 'sms', 'push')),
  ref        text not null default '',
  due_at     timestamptz not null,
  status     text not null default 'due' check (status in ('due', 'sent', 'skipped', 'failed')),
  sent_at    timestamptz,
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, step, channel, ref)
);

create index if not exists cc_journey_due_idx on public.cc_journey (status, due_at);
create index if not exists cc_journey_user_idx on public.cc_journey (user_id);

alter table public.cc_journey enable row level security;

drop policy if exists "cc_journey: team reads" on public.cc_journey;
create policy "cc_journey: team reads" on public.cc_journey
  for select using (public.cc_is_team());

grant select on public.cc_journey to authenticated;

-- ── Settings ────────────────────────────────────────────────────────────────
-- One row. The switches the brief leaves to Leah and Logan.

create table if not exists public.cc_settings (
  id                   boolean primary key default true check (id),
  journey_enabled      boolean not null default true,
  -- Off until the carrier registration is through and the sign-up checkbox exists.
  texting_enabled      boolean not null default false,
  discord_wins_enabled boolean not null default true,
  -- "Whether messages come from Leah personally or from The Practice."
  sender               text not null default 'Leah' check (sender in ('Leah', 'The Practice')),
  -- The holiday gift counter's goal, if the team sets one. 0 is no goal.
  gift_goal            integer not null default 0,
  updated_at           timestamptz not null default now()
);

insert into public.cc_settings (id) values (true) on conflict (id) do nothing;

alter table public.cc_settings enable row level security;

drop policy if exists "cc_settings: team reads" on public.cc_settings;
create policy "cc_settings: team reads" on public.cc_settings
  for select using (public.cc_is_team());

drop policy if exists "cc_settings: admins update" on public.cc_settings;
create policy "cc_settings: admins update" on public.cc_settings
  for update using (public.cc_is_admin()) with check (public.cc_is_admin());

grant select, update on public.cc_settings to authenticated;

-- ── The scoreboard's snapshot ───────────────────────────────────────────────
-- What only Stripe can say (recurring revenue), written by the hourly job,
-- and when the job last ran, so the Setup page can say so.

create table if not exists public.cc_stats (
  id            boolean primary key default true check (id),
  mrr_cents     bigint not null default 0,
  active_paying integer not null default 0,
  trialing      integer not null default 0,
  cron_ran_at   timestamptz,
  cron_note     text,
  updated_at    timestamptz not null default now()
);

insert into public.cc_stats (id) values (true) on conflict (id) do nothing;

alter table public.cc_stats enable row level security;

drop policy if exists "cc_stats: team reads" on public.cc_stats;
create policy "cc_stats: team reads" on public.cc_stats
  for select using (public.cc_is_team());

grant select on public.cc_stats to authenticated;

-- ── The scoreboard ──────────────────────────────────────────────────────────
-- The handful of numbers on the home screen, in one read. Counts only: this
-- is the one function here that touches the app's own tables, and it returns
-- nothing about any one person.

create or replace function public.cc_scoreboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  day_start   timestamptz := date_trunc('day', now());
  week_start  timestamptz := date_trunc('week', now());
  month_start timestamptz := date_trunc('month', now());
  result      jsonb;
begin
  if not public.cc_is_team() then
    raise exception 'not on the team' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'joins_today',      (select count(*) from public.cc_pulse_events where kind = 'join' and occurred_at >= day_start),
    'trials_week',      (select count(*) from public.cc_pulse_events where kind = 'join' and occurred_at >= week_start),
    'trials_month',     (select count(*) from public.cc_pulse_events where kind = 'join' and occurred_at >= month_start),
    'upgrades_month',   (select count(*) from public.cc_pulse_events where kind = 'upgrade' and occurred_at >= month_start),
    -- Trial to paid: of the trials that started more than a week ago, how
    -- many are paying now.
    'cohort_joins',     (select count(*) from public.cc_pulse_events
                          where kind = 'join' and occurred_at < now() - interval '7 days'),
    'cohort_converted', (select count(*) from public.cc_pulse_events e
                          join public.memberships m on m.user_id = e.user_id
                          where e.kind = 'join' and e.occurred_at < now() - interval '7 days'
                            and m.status in ('active', 'past_due')),
    'active_paying',    (select count(*) from public.memberships where status in ('active', 'past_due')),
    'trialing',         (select count(*) from public.memberships where status = 'trialing'),
    'cancelling',       (select count(*) from public.memberships
                          where status in ('active', 'trialing', 'past_due') and cancel_at_period_end),
    'members_total',    (select count(*) from public.profiles),
    'active_7d',        (select count(distinct user_id) from public.practice_days where day >= current_date - 6),
    'merch_month_cents',(select coalesce(sum((detail ->> 'amount_cents')::bigint), 0) from public.cc_pulse_events
                          where kind = 'merch' and occurred_at >= month_start),
    'merch_month_orders',(select count(*) from public.cc_pulse_events where kind = 'merch' and occurred_at >= month_start),
    'top_items',        (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'count', t.n) order by t.n desc), '[]'::jsonb)
                           from (select item ->> 'name' as name, sum(coalesce((item ->> 'quantity')::int, 1)) as n
                                   from public.cc_pulse_events, jsonb_array_elements(coalesce(detail -> 'items', '[]'::jsonb)) item
                                  where kind = 'merch' and occurred_at >= month_start
                                  group by 1 order by 2 desc limit 5) t),
    'gifts_total',      (select count(*) from public.cc_pulse_events where kind = 'gift'),
    'gifts_month',      (select count(*) from public.cc_pulse_events where kind = 'gift' and occurred_at >= month_start),
    'referrals_sent',   0,
    'referrals_converted', 0,
    'tasks_week',       0,
    'mrr_cents',        (select mrr_cents from public.cc_stats where id),
    'stats_at',         (select updated_at from public.cc_stats where id),
    'cron_ran_at',      (select cron_ran_at from public.cc_stats where id)
  ) into result;

  return result;
end $$;

revoke all on function public.cc_scoreboard() from public, anon;
grant execute on function public.cc_scoreboard() to authenticated;

-- ── Housekeeping ────────────────────────────────────────────────────────────

create or replace function public.cc_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists cc_team_updated_at on public.cc_team;
create trigger cc_team_updated_at before update on public.cc_team
  for each row execute function public.cc_set_updated_at();

drop trigger if exists cc_settings_updated_at on public.cc_settings;
create trigger cc_settings_updated_at before update on public.cc_settings
  for each row execute function public.cc_set_updated_at();

drop trigger if exists cc_stats_updated_at on public.cc_stats;
create trigger cc_stats_updated_at before update on public.cc_stats
  for each row execute function public.cc_set_updated_at();
