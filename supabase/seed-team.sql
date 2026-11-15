-- The team, as the brief names them. Fill in each person's sign-in email (the
-- address they use for the Practice app) and run this once in the SQL editor.
-- Lanes and responsibilities are the brief's "Decisions for Leah and Logan":
-- edit freely; the roles page reads them.
--
-- Whoever is admin can also edit the team from the Command Center later.
-- assigns_tasks: who gives out the to-dos and sees all of them (Leah, and
-- Logan so he can edit the lists for her). Run
-- the to-dos migration (20261116000000_team_todos.sql) before this file.

insert into public.cc_team (email, name, lane, responsibilities, is_admin, assigns_tasks) values
  ('<leah-email>',      'Leah',      'Founder',       '{"Morning message","Approves member copy","Masterclass"}', true, true),
  ('<logan-email>',     'Logan',     'Build',         '{"The app","The Command Center","Integrations"}',          true, true),
  ('<abra-email>',      'Abra',      'Member care',   '{"Welcome follow-ups","Member questions","Refunds"}',      false, false),
  ('<amy-email>',       'Amy',       'Community',     '{"Discord posts","Lab sessions"}',                         false, false),
  ('<michelle-email>',  'Michelle',  'Brand',         '{"Merch","Social","Tagged in merch"}',                     false, false),
  ('<christina-email>', 'Christina', 'Operations',    '{"Rep of the Day","Scheduling"}',                          false, false)
on conflict (email) do update
  set name = excluded.name,
      lane = excluded.lane,
      responsibilities = excluded.responsibilities,
      is_admin = excluded.is_admin,
      assigns_tasks = excluded.assigns_tasks;
