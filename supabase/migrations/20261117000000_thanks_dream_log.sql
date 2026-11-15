-- ═══════════════════════════════════════════════════════════════════════════
-- The Practice Command Center — the Gratitude Wall, the Dream Board, the
-- morning message and the daily log
--
-- Run after 20261116000000_team_todos.sql. Safe to run more than once.
--
-- The team writes these from the browser. Row-level security keeps a thank
-- you or a log line to the person making it, and the things Leah owns (the
-- morning message, the goals, the vision and the bonus pool) to admins.
-- Nothing here touches a member's practice.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.cc_me()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- ── Shout outs (and the Gratitude wall) ─────────────────────────────────────

create table if not exists public.cc_shoutouts (
  id          uuid primary key default gen_random_uuid(),
  from_email  text not null default public.cc_me(),
  to_email    text not null references public.cc_team (email) on update cascade on delete cascade,
  task_id     uuid references public.cc_tasks (id) on delete set null,
  message     text not null check (char_length(btrim(message)) between 1 and 280),
  created_at  timestamptz not null default now(),
  check (from_email <> to_email)
);

create index if not exists cc_shoutouts_when_idx on public.cc_shoutouts (created_at desc);

alter table public.cc_shoutouts enable row level security;

drop policy if exists "cc_shoutouts: team reads" on public.cc_shoutouts;
create policy "cc_shoutouts: team reads" on public.cc_shoutouts for select using (public.cc_is_team());
drop policy if exists "cc_shoutouts: from you" on public.cc_shoutouts;
create policy "cc_shoutouts: from you" on public.cc_shoutouts for insert
  with check (public.cc_is_team() and from_email = public.cc_me());
drop policy if exists "cc_shoutouts: yours to take back" on public.cc_shoutouts;
create policy "cc_shoutouts: yours to take back" on public.cc_shoutouts for delete
  using (public.cc_is_admin() or (public.cc_is_team() and from_email = public.cc_me()));

grant select, insert, delete on public.cc_shoutouts to authenticated;

-- ── The morning message from Leah ───────────────────────────────────────────

create table if not exists public.cc_notes (
  for_date    date primary key,
  body        text not null check (char_length(btrim(body)) between 1 and 1200),
  author      text not null default public.cc_me(),
  updated_at  timestamptz not null default now()
);

alter table public.cc_notes enable row level security;

drop policy if exists "cc_notes: team reads" on public.cc_notes;
create policy "cc_notes: team reads" on public.cc_notes for select using (public.cc_is_team());
drop policy if exists "cc_notes: admins write" on public.cc_notes;
create policy "cc_notes: admins write" on public.cc_notes for all
  using (public.cc_is_admin()) with check (public.cc_is_admin());

grant select, insert, update, delete on public.cc_notes to authenticated;

-- ── The Dream Board ─────────────────────────────────────────────────────────
-- Leah's goals. A goal follows a number the scoreboard already has, or a
-- number she keeps by hand ('metric' = 'manual').

create table if not exists public.cc_goals (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  metric        text not null default 'manual' check (metric in (
                  'members_total', 'active_paying', 'mrr', 'upgrades_month', 'trials_month',
                  'gifts_total', 'merch_month', 'active_7d', 'practice_days_total', 'club_spots_total', 'manual')),
  target        numeric not null check (target > 0),
  manual_value  numeric not null default 0,
  by_date       date,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.cc_goals enable row level security;

drop policy if exists "cc_goals: team reads" on public.cc_goals;
create policy "cc_goals: team reads" on public.cc_goals for select using (public.cc_is_team());
drop policy if exists "cc_goals: admins write" on public.cc_goals;
create policy "cc_goals: admins write" on public.cc_goals for all
  using (public.cc_is_admin()) with check (public.cc_is_admin());

grant select, insert, update, delete on public.cc_goals to authenticated;

-- The vision, the mission, and the bonus pool live on the one settings row.
alter table public.cc_settings add column if not exists vision text not null default '';
alter table public.cc_settings add column if not exists mission text not null default '';
-- The pool: so much per trial that upgrades, toward a monthly goal of upgrades.
alter table public.cc_settings add column if not exists pool_per_upgrade_cents integer not null default 0 check (pool_per_upgrade_cents >= 0);
alter table public.cc_settings add column if not exists pool_goal_upgrades integer not null default 0 check (pool_goal_upgrades >= 0);
alter table public.cc_settings add column if not exists pool_reward text not null default '';
-- The Welcome Journey emails drafted in Leah's voice that she has read and turned on.
alter table public.cc_settings add column if not exists journey_approved text[] not null default '{}';

-- ── Realtime: thank yous, the morning message and the log land for everyone ─

do $$
declare
  t text;
begin
  foreach t in array array['cc_shoutouts', 'cc_notes'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Where the movement is: cities, as counts ────────────────────────────────

create or replace function public.cc_cities()
returns table (city text, members bigint, latest timestamptz)
language sql stable security definer set search_path = public as $$
  select initcap(btrim(e.city)) as city, count(*) as members, max(e.occurred_at) as latest
    from public.cc_pulse_events e
   where public.cc_is_team() and e.kind = 'join' and coalesce(btrim(e.city), '') <> ''
   group by 1
   order by 2 desc, 3 desc
   limit 60
$$;

revoke all on function public.cc_cities() from public, anon;
grant execute on function public.cc_cities() to authenticated;

-- ── The scoreboard, with the board's own numbers ────────────────────────────

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
    -- Lives Touched: totals only, never by person.
    'practice_days_total', (select count(*) from public.practice_days),
    'club_spots_total', (select count(*) from public.club_event_spots),
    'merch_orders_total', (select count(*) from public.cc_pulse_events where kind = 'merch'),
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
    'referrals_converted', (select count(*) from public.cc_pulse_events where kind = 'referral'),
    'tasks_week',       (select count(*) from public.cc_tasks where status = 'done' and done_at >= week_start),
    'thanks_week',      (select count(*) from public.cc_shoutouts where created_at >= week_start),
    'mrr_cents',        (select mrr_cents from public.cc_stats where id),
    'stats_at',         (select updated_at from public.cc_stats where id),
    'cron_ran_at',      (select cron_ran_at from public.cc_stats where id)
  ) into result;

  return result;
end $$;

revoke all on function public.cc_scoreboard() from public, anon;
grant execute on function public.cc_scoreboard() to authenticated;

-- ── Housekeeping ────────────────────────────────────────────────────────────

drop trigger if exists cc_notes_updated_at on public.cc_notes;
create trigger cc_notes_updated_at before update on public.cc_notes
  for each row execute function public.cc_set_updated_at();

drop trigger if exists cc_goals_updated_at on public.cc_goals;
create trigger cc_goals_updated_at before update on public.cc_goals
  for each row execute function public.cc_set_updated_at();

-- ── The daily log ───────────────────────────────────────────────────────────

create table if not exists public.cc_logs (
  id          uuid primary key default gen_random_uuid(),
  email       text not null default public.cc_me() references public.cc_team (email) on update cascade on delete cascade,
  on_date     date not null default current_date,
  body        text not null check (char_length(btrim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists cc_logs_day_idx on public.cc_logs (on_date desc, email);

alter table public.cc_logs enable row level security;

drop policy if exists "cc_logs: team reads" on public.cc_logs;
create policy "cc_logs: team reads" on public.cc_logs for select using (public.cc_is_team());
drop policy if exists "cc_logs: yours" on public.cc_logs;
create policy "cc_logs: yours" on public.cc_logs for insert
  with check (public.cc_is_team() and email = public.cc_me());
drop policy if exists "cc_logs: change yours" on public.cc_logs;
create policy "cc_logs: change yours" on public.cc_logs for update
  using (public.cc_is_team() and email = public.cc_me()) with check (email = public.cc_me());
drop policy if exists "cc_logs: take yours back" on public.cc_logs;
create policy "cc_logs: take yours back" on public.cc_logs for delete
  using (public.cc_is_admin() or (public.cc_is_team() and email = public.cc_me()));

grant select, insert, update, delete on public.cc_logs to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cc_logs'
  ) then
    alter publication supabase_realtime add table public.cc_logs;
  end if;
end $$;
