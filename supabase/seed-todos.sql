-- The brief's recurring tasks, to start the board with (optional). Run after
-- the team is in (seed-team.sql) and both migrations have run. Each one is
-- given to the person whose lane it is in the team seed; change who in the
-- Command Center afterwards. Running it twice adds them twice.

with leah as (select email from public.cc_team where lower(name) = 'leah' limit 1)
insert into public.cc_tasks (title, notes, assignee_email, created_by, due_on, repeat)
select t.title, t.notes, m.email, (select email from leah), t.due_on, t.repeat
  from (values
    ('Post Leah''s message in Discord', 'Monday, Wednesday and Friday, once Leah approves it.', 'amy', current_date, 'mwf'),
    ('Rep of the Day is up', 'Check today''s Rep of the Day is live in the app.', 'christina', current_date, 'daily'),
    ('Masterclass prep', 'Outline, slides and the invite for this month''s Masterclass.', 'leah', (date_trunc('month', current_date) + interval '20 days')::date, 'monthly'),
    ('Welcome follow-ups', 'A personal note to anyone whose trial ends in 48 hours (the Live Pulse''s Needs you).', 'abra', current_date, 'weekdays')
  ) as t(title, notes, who, due_on, repeat)
  join public.cc_team m on lower(m.name) = t.who;
