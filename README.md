# The Practice Command Center

One place for the team to run The Practice: see member activity as it happens, welcome every new
member automatically, celebrate wins together in Discord, and (in later phases) run the team's tasks,
the referral program and the scoreboard. The build brief is in [`docs/build-brief.md`](docs/build-brief.md).

**Stack:** React + Vite on Vercel · the Practice app's own Supabase project (Postgres + Auth +
Realtime) · Vercel functions in `api/` · Resend for email, Twilio for text, a Discord channel webhook.

This is a separate app from the Practice app (`practice-by-innerboard`). It shares the database and
nothing else; its own tables are all prefixed `cc_`.

**The look:** the Detail on Demand Command Center's layout (a floating sidebar grouped into Overview,
Members and Team with count badges, large-title screens, a hero strip, "Needs you" and "Handled
automatically today", trend tiles with a Daily, Weekly and Monthly switch, a phone bar with a menu
sheet, and a dark mode toggle) in the Practice's ivory, navy and gold.

## What is in Phase 1

| Piece | Where |
| --- | --- |
| **Live Pulse** — joins, upgrades, merch orders, gifts, trials ending, cancels, the instant they happen, with the month's seasonal burst and a soft chime for the loud ones | Home and Live Pulse screens; `api/stripe.js`, `src/lib/usePulse.js` |
| **Discord #wins** — one line per loud moment, first name and city only, with the running count | `api/_lib/discord.js`, `api/_lib/words.js` |
| **Welcome Journey** — the welcome email and text, Day 1 in app, Day 2 merch, the upgrade thank-you, the merch thank-you; Day 4, Day 6 and "quiet for 10 days" planned and waiting on Leah's copy | `api/_lib/journey.js`, `api/_lib/words.js`, `api/cron.js` |
| **Gift tracking** — any Stripe Payment Link whose metadata says `kind=gift` counts, on the board and in Discord | `api/_lib/pulse.js` |
| **Scoreboard** — the top row: trials, trial to paid, paying members and recurring revenue, merch, app use, gifts | `supabase/migrations`, `cc_scoreboard()` |
| **Needs you** — cancels and trials ending as quiet cards, with Handled and, for an admin, the member's address for a personal note | `src/components/PulseCard.jsx`, `api/admin.js` |

Phase 2 (Team Board, Discord slash commands), Phase 3 (referrals, bonus pool) and Phase 4 (Keep the
Dream Alive) build on these tables.

## Set it up

### 1. The database

In the Supabase dashboard of the **Practice app's project**, open the SQL editor and run
`supabase/migrations/20261115000000_command_center.sql`. It adds the `cc_` tables, their row-level
security, the Realtime publication for the board, and `cc_scoreboard()`. Safe to run more than once.

Then open `supabase/seed-team.sql`, put each person's sign-in email in place of the placeholders, and
run it. Whoever's email is on `cc_team` can open the Command Center; `is_admin` may change settings and
ask for a member's address.

### 2. Environment variables

Copy `.env.example` to `.env.local` for local work, and set the same in Vercel → Project → Settings →
Environment Variables. The two `VITE_` values are the Practice app's own public ones. Everything else is
server-only and must never get a `VITE_` prefix.

| Variable | What it is |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | The Practice project's URL and anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | The same project's service role key (server only) |
| `STRIPE_SECRET_KEY` | The Practice's Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of **this app's** endpoint (step 4) |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend, and the from address, on the domain that sends the Practice's mail |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Texts, once the carrier registration is through (optional) |
| `DISCORD_WINS_WEBHOOK_URL` | A webhook made on the #wins channel |
| `CRON_SECRET` | Any long random string; Vercel sends it to the hourly job |
| `PRACTICE_URL` | Where members are: `https://www.practiceinnerboard.com` |
| `APP_URL` | This app's own address once deployed |

### 3. Deploy on Vercel

Import the repo in Vercel. `vercel.json` sets the build, the SPA rewrite, the security headers and the
hourly job (`/api/cron`, `0 * * * *`). On Vercel's Hobby plan a cron may run only once a day: change the
schedule to `0 13 * * *` there, and the job catches up on everything due since its last run. Add the Command Center's address to the Practice project's Authentication → URL Configuration
→ Redirect URLs, so the email link and Google sign-in come back here.

### 4. Stripe's second endpoint

Stripe sends every event to as many endpoints as you give it. The Practice app keeps its own; this
app gets another. In Stripe: Developers → Webhooks → Add endpoint → `<APP_URL>/api/stripe`, with these
events:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Copy the endpoint's signing secret into Vercel as `STRIPE_WEBHOOK_SECRET` and redeploy. The Setup
screen shows the exact address and events to copy.

For the holiday gift (hat plus one year), make a Stripe Payment Link for it and give the link metadata
`kind` = `gift` and `item` = `Hat plus one year`. Every paid checkout through it is a gift on the board
and in #wins. Stripe does not need to know anything else.

### 5. Discord

On the #wins channel: Edit channel → Integrations → Webhooks → New webhook. Its URL goes in Vercel as
`DISCORD_WINS_WEBHOOK_URL`. The Setup screen's "Post a test line to #wins" shows it landing.

### 6. Email and text

Resend: a key for the domain the Practice sends from, in `RESEND_API_KEY`, and the from address in
`MAIL_FROM`. The Welcome Journey screen's "Send me a test" puts each email in your own inbox.

Text needs two things that take time: a business texting registration with the carriers (A2P 10DLC,
through Twilio, often a couple of weeks) and an opt-in checkbox at sign-up in the Practice app. Until
both are there, leave the texting switch off; the welcome text is planned and skipped with the reason,
never sent.

## Run it locally

```bash
npm install
cp .env.example .env.local      # fill it in
npm run dev                     # the screens, on http://localhost:5174
npm run dev:api                 # vercel dev: the screens and the api/ functions together
```

`npm run dev` alone is enough for the board; the Setup and test calls need `npm run dev:api`.

## Checks

```bash
npm run lint
npm test
npm run build
```

## How it hangs together

```
Stripe ──POST /api/stripe──▶ pulseFrom(event)  ──▶ cc_pulse_events (one row per moment, by source id)
                                   │                      │
                                   │                      └──Realtime──▶ the board (burst, chime)
                                   ├──▶ Discord #wins (first name, city, what happened)
                                   └──▶ cc_journey (the steps this moment plans)

Vercel cron ──GET /api/cron (hourly)──▶ trials ending in 48h → quiet cards
                                     ▶ members quiet 10 days → "we miss you" (once Leah's copy is in)
                                     ▶ due journey steps → Resend / Twilio / push
                                     ▶ MRR from Stripe → cc_stats

The team ──signs in with their Practice account──▶ reads cc_* under RLS (cc_is_team())
                                                 ▶ /api/admin: health, a member's address (admins), a test email
```

## Privacy, in one paragraph

The team sees a first name and a city on the board and in Discord, and never a member's practice:
this app does not read routine entries, coach conversations, wins or journals, not even as counts
that could be traced to one person. Contact details are shown to an admin, one member at a time, on
request, and are never stored on the Command Center's tables. Texts need the member's own opt-in.
See `AGENTS.md` for the rules in full.
