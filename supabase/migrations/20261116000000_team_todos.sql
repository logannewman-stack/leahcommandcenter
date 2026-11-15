-- ═══════════════════════════════════════════════════════════════════════════
-- Team to-dos
--
-- Logan, November 15: "a team to do and Leah can see all of them and the
-- other people can only see what Leah assigns to them and they can click
-- done on theirs and it then shows completed on mom's."
--
-- ── Who sees what ────────────────────────────────────────────────────────
-- `cc_team.assigns_tasks` marks who gives out the to-dos (Leah). They see
-- every to-do, make them, change them and delete them. Everyone else on the
-- team sees only the to-dos assigned to them, and the one thing they can do
-- to one is mark it done or not done, through `cc_set_task_done()`. The
-- row-level security below is the guard, not the screens.
--
-- ── Repeating to-dos ─────────────────────────────────────────────────────
-- The brief's recurring tasks (Monday, Wednesday and Friday Discord posts;
-- the daily Rep of the Day; monthly Masterclass prep). Marking one done
-- makes the next one, due on the next day it repeats on; marking it not
-- done again takes that next one back while nobody has touched it.
--
-- Run after 20261115000000_command_center.sql. Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Who gives out the to-dos ────────────────────────────────────────────────

alter table public.cc_team
  add column if not exists assigns_tasks boolean not null default false;

comment on column public.cc_team.assigns_tasks is
  'Gives out the team''s to-dos: sees every one, makes, changes and deletes '
  'them. Everyone else sees only the to-dos assigned to them.';

-- Leah does, as the brief has it. More people can be given it on Roles.
update public.cc_team set assigns_tasks = true where lower(name) = 'leah' and not assigns_tasks;

-- The days the team counts in: "today" for a repeating to-do's next date.
alter table public.cc_settings
  add column if not exists time_zone text not null default 'America/Chicago';

create or replace function public.cc_my_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.cc_is_task_lead()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cc_team t
     where t.active and t.assigns_tasks and t.email = public.cc_my_email()
  )
$$;

revoke all on function public.cc_is_task_lead() from public, anon;
grant execute on function public.cc_is_task_lead() to authenticated;

-- ── The to-dos ──────────────────────────────────────────────────────────────

create table if not exists public.cc_tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (length(btrim(title)) between 1 and 200),
  notes          text check (notes is null or length(notes) <= 2000),
  assignee_email text not null references public.cc_team (email) on update cascade on delete cascade,
  -- Who gave it out, for "Assigned by Leah". Stamped on insert.
  created_by     text,
  due_on         date,
  repeat         text not null default 'none'
                   check (repeat in ('none', 'daily', 'weekdays', 'mwf', 'weekly', 'monthly')),
  status         text not null default 'open' check (status in ('open', 'done')),
  done_at        timestamptz,
  done_by        text,
  -- A repeating to-do, once done: the next one it made.
  next_id        uuid,
  -- Every occurrence of one repeating to-do shares this.
  series_id      uuid,
  sort_order     double precision not null default extract(epoch from now()),
  -- When its check-off went to Discord, so it goes once.
  announced_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists cc_tasks_assignee_idx on public.cc_tasks (assignee_email, status, due_on);
create index if not exists cc_tasks_done_idx on public.cc_tasks (status, done_at desc);

create or replace function public.cc_tasks_stamp()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, nullif(public.cc_my_email(), ''));
    new.series_id := coalesce(new.series_id, new.id);
  end if;
  new.assignee_email := lower(btrim(new.assignee_email));
  new.title := btrim(new.title);
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists cc_tasks_stamp on public.cc_tasks;
create trigger cc_tasks_stamp before insert or update on public.cc_tasks
  for each row execute function public.cc_tasks_stamp();

alter table public.cc_tasks enable row level security;

drop policy if exists "cc_tasks: lead sees all, others their own" on public.cc_tasks;
create policy "cc_tasks: lead sees all, others their own" on public.cc_tasks
  for select using (public.cc_is_task_lead() or (public.cc_is_team() and assignee_email = public.cc_my_email()));

drop policy if exists "cc_tasks: lead adds" on public.cc_tasks;
create policy "cc_tasks: lead adds" on public.cc_tasks
  for insert with check (public.cc_is_task_lead());

drop policy if exists "cc_tasks: lead changes" on public.cc_tasks;
create policy "cc_tasks: lead changes" on public.cc_tasks
  for update using (public.cc_is_task_lead()) with check (public.cc_is_task_lead());

drop policy if exists "cc_tasks: lead deletes" on public.cc_tasks;
create policy "cc_tasks: lead deletes" on public.cc_tasks
  for delete using (public.cc_is_task_lead());

grant select, insert, update, delete on public.cc_tasks to authenticated;

-- Leah's list updates the moment someone checks one off (Supabase Realtime,
-- which reads the select policy above before it hands anyone a row).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cc_tasks'
  ) then
    alter publication supabase_realtime add table public.cc_tasks;
  end if;
end $$;

-- ── Done, and not done ──────────────────────────────────────────────────────

-- The next day a repeating to-do is due, after `from_day`.
create or replace function public.cc_next_due(from_day date, repeat text)
returns date language plpgsql immutable as $$
declare
  d date := from_day;
begin
  if repeat = 'daily' then return from_day + 1; end if;
  if repeat = 'weekly' then return from_day + 7; end if;
  if repeat = 'monthly' then return (from_day + interval '1 month')::date; end if;
  if repeat = 'weekdays' then
    loop d := d + 1; exit when extract(isodow from d) < 6; end loop;
    return d;
  end if;
  if repeat = 'mwf' then
    loop d := d + 1; exit when extract(isodow from d) in (1, 3, 5); end loop;
    return d;
  end if;
  return null;
end $$;

/*
 * The one thing a teammate can do to a to-do: mark it done or not done. The
 * person it is assigned to, or whoever gives out the to-dos; nobody else.
 * Returns the to-do as it is now, the next one a repeating to-do made, and
 * the id of a next one it took back.
 */
create or replace function public.cc_set_task_done(task_id uuid, done boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.cc_tasks;
  spawned public.cc_tasks;
  me text := public.cc_my_email();
  today date;
  nxt date;
  removed uuid;
begin
  select * into t from public.cc_tasks where id = task_id for update;
  if not found then
    raise exception 'no such to-do' using errcode = 'P0002';
  end if;
  if not (public.cc_is_task_lead() or (public.cc_is_team() and t.assignee_email = me)) then
    raise exception 'that to-do is not yours' using errcode = '42501';
  end if;

  select (now() at time zone coalesce((select s.time_zone from public.cc_settings s where s.id), 'America/Chicago'))::date into today;

  if done then
    if t.status = 'done' then
      return jsonb_build_object('task', to_jsonb(t), 'next', null, 'removed', null);
    end if;
    if t.repeat <> 'none' and t.next_id is null then
      nxt := public.cc_next_due(coalesce(t.due_on, today), t.repeat);
      -- Done late: the next one is the next day it repeats on from today, never one already past.
      if nxt <= today then
        nxt := public.cc_next_due(today, t.repeat);
      end if;
      insert into public.cc_tasks (title, notes, assignee_email, created_by, due_on, repeat, series_id, sort_order)
      values (t.title, t.notes, t.assignee_email, t.created_by, nxt, t.repeat, t.series_id, t.sort_order)
      returning * into spawned;
    end if;
    update public.cc_tasks
       set status = 'done', done_at = now(), done_by = me, next_id = coalesce(spawned.id, t.next_id)
     where id = task_id
     returning * into t;
    return jsonb_build_object('task', to_jsonb(t), 'next', case when spawned.id is null then null else to_jsonb(spawned) end, 'removed', null);
  end if;

  if t.status = 'open' then
    return jsonb_build_object('task', to_jsonb(t), 'next', null, 'removed', null);
  end if;
  if t.next_id is not null then
    delete from public.cc_tasks where id = t.next_id and status = 'open' returning id into removed;
  end if;
  update public.cc_tasks
     set status = 'open', done_at = null, done_by = null, next_id = null
   where id = task_id
   returning * into t;
  return jsonb_build_object('task', to_jsonb(t), 'next', null, 'removed', removed);
end $$;

revoke all on function public.cc_set_task_done(uuid, boolean) from public, anon;
grant execute on function public.cc_set_task_done(uuid, boolean) to authenticated;
