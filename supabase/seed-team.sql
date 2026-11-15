-- The team, as the brief names them. Fill in each person's sign-in email (the
-- address they use for the Practice app) and run this once in the SQL editor.
-- Lanes and responsibilities are the brief's "Decisions for Leah and Logan":
-- edit freely; the roles page reads them.
--
-- Whoever is admin can also edit the team from the Command Center later.

insert into public.cc_team (email, name, lane, responsibilities, is_admin) values
  ('<leah-email>',      'Leah',      'Founder',       '{"Morning message","Approves member copy","Masterclass"}', true),
  ('<logan-email>',     'Logan',     'Build',         '{"The app","The Command Center","Integrations"}',          true),
  ('<abra-email>',      'Abra',      'Member care',   '{"Welcome follow-ups","Member questions","Refunds"}',      false),
  ('<amy-email>',       'Amy',       'Community',     '{"Discord posts","Lab sessions"}',                         false),
  ('<michelle-email>',  'Michelle',  'Brand',         '{"Merch","Social","Tagged in merch"}',                     false),
  ('<christina-email>', 'Christina', 'Operations',    '{"Rep of the Day","Scheduling"}',                          false)
on conflict (email) do update
  set name = excluded.name,
      lane = excluded.lane,
      responsibilities = excluded.responsibilities,
      is_admin = excluded.is_admin;
