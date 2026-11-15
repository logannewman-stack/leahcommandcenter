# AGENTS.md

## Project context

The Practice Command Center: the team's own app for running The Practice (practiceinnerboard.com).
One place to see member activity as it happens (Live Pulse), welcome every new member automatically
(Welcome Journey), post wins to the team's Discord, and, in later phases, run the team's tasks, the
referral program and the scoreboard. The build brief is `docs/build-brief.md`.

It is a **separate app from the Practice app** (`practice-by-innerboard`) and shares nothing with it
but the database: the same Supabase project, read through the service key on the server and through
each team member's own sign-in in the browser. The Practice app's code is never imported here.

**Stack:** React + Vite on Vercel · Supabase (Postgres + Auth + Realtime) · Vercel functions in `api/`
(Stripe webhook, hourly job, admin calls) · Resend for email, Twilio for text, a Discord channel webhook.

## Key files

- `supabase/migrations/` — every table this app adds, all prefixed `cc_`, with row-level security.
  `cc_is_team()` is the one gate: a signed-in person whose email is on `cc_team` may read; only the
  service key writes. Apply migrations to the Practice app's project (README).
- `api/stripe.js` — Stripe's second webhook endpoint: a join, an upgrade, a cancel, a merch order, a
  gift. `api/_lib/pulse.js` turns an event into a pulse row; `api/_lib/members.js` finds whose it is.
- `api/cron.js` — the hourly job: trials ending, members gone quiet, the Welcome Journey's due
  steps, the scoreboard snapshot.
- `api/admin.js` — what the team asks the server for: health, a member's contact details for a
  personal note, a test email.
- `api/_lib/words.js` — every message to a member and every line on the feed or in Discord. Leah's
  own drafts (the brief's appendix). Edit copy here and nowhere else.
- `src/lib/seasons.js`, `src/lib/season-shapes.js` — the Practice app's seasonal celebration, ported
  as is. A change to the motifs belongs in the Practice app first.
- `src/styles/command-center.css` — the look. The layout and feel are the Detail on Demand Command
  Center's (a floating frosted sidebar, large-title screens, glass cards, icon-tile rows, a hero strip,
  count badges, a phone bar with a menu sheet); every color is the Practice's. The `tone-*` classes
  (navy, plum, amber, green, gold, rust, ink) are the Practice app's routine colors: use them for
  tiles, badges and charts, never a new hex.
- `src/components/ui.jsx` — the kit every screen is built from: `Page`, `Card`, `IconTile`, `LinkRow`,
  `Badge`, `Chip`, `Segmented`, `Switch`, `StatCard`, `Notice`, `EmptyState`, `Sheet`.
- `src/lib/nav.js` — the sidebar's groups and items, as data. A new screen is an entry here and a route
  in `src/App.jsx` (the suite checks the two match).
- `src/lib/live.jsx` — the one Realtime channel, the badge counts and the celebration burst.
- `src/lib/tasksStore.jsx` — the team to-dos: what each person may see, kept live, and every change
  drawn at once and saved after (a failed save puts it back and says so). `src/lib/tasks.js` holds the
  dates, sections and progress as pure functions; `nextDue()` must match `cc_next_due()` in the migration.
- `src/lib/toast.jsx` — the notes that rise from the bottom ("Done · Undo", "Abra finished a to-do").
- `src/index.css` — the Practice's color tokens. Never hard-code a color; both themes come from them.

## Privacy rules (non-negotiable)

These come from the brief and from the Practice app's own rules, and they are enforced in code.

- **The team never sees a member's practice.** This app does not read `routine_entries`,
  `coach_messages`, `coach_conversations`, `wins`, `win_docs`, `tool_runs`, `plan_items`, journals or
  anything else a member wrote. Not in a query, not in an aggregate that could be traced to a person.
  Counts of activity (a practice day happened) are the most it reads, and only as totals or as
  "quiet for 10 days".
- **First name and city on the feed and in Discord.** Nothing else about a member leaves the server
  on those two surfaces. `cc_pulse_events` carries no email, phone or payment detail.
- **Emails, phones and payment details are the admin view's only** (`api/admin.js`, a team admin,
  on request, for one member at a time). They are never stored on this app's own tables.
- **To-dos: Leah sees all, everyone else their own.** `cc_team.assigns_tasks` marks who gives them
  out. The select policy on `cc_tasks` is the guard; a teammate's only write is `cc_set_task_done()`.
  Never widen either to make a screen easier.
- **Texting needs the member's opt-in** (`profiles.reminder_sms` with a number) and the texting switch
  on in Settings. No opt-in, no text, whatever the journey says.
- **Secrets stay on the server.** `SUPABASE_SERVICE_ROLE_KEY`, Stripe, Resend, Twilio and Discord keys
  are read in `api/` only. Anything prefixed `VITE_` ships to the browser.

## Copy rules, from the Practice's OS rules

Every message a member receives follows Leah's rules: the situation is neutral, always; nothing shames
("we miss you" never "you haven't"); banned words in UI copy: private · choice point · pressure ·
under pressure · drift · steadiness · enterprise; "team members" not "employees". The drafts in
`words.js` are Leah's; a step whose copy she has not approved stays `enabled: false`.

## Working notes

- Run `npm run lint`, `npm test` and `npm run build` before finishing.
- One Vercel function per address family (`api/stripe.js`, `api/cron.js`, `api/admin.js`): the Hobby
  plan deploys at most twelve, and the Practice app learned this the hard way.
- Every send is idempotent: a Stripe event's id, a journey row's id. A webhook delivered twice is one
  pulse card, one Discord post, one email.
