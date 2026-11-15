# The Practice Command Center — build brief

Build brief for Logan, November 2026. One place for the team to run the work, see member activity as
it happens, celebrate wins together, and take great care of every person who comes into The Practice.

## The short version

Six pieces, built in three phases:

- **Team Board**: roles, responsibilities, and a shared task list with checkoffs, streaks, and confetti.
- **Live Pulse**: a real time feed of new members, merch orders, and trial upgrades.
- **Welcome Journey**: automatic email and text messages so new members feel welcomed and cared for.
- **Discord Bridge**: wins and checkoffs post to the InnerBoard Team server, and the team can mark tasks
  done from Discord.
- **Rewards**: a team bonus pool plus a member referral program.
- **Scoreboard**: the handful of numbers that tell us how the movement is growing.
- **Keep the Dream Alive** (Phase 4): the Movement Map, Lives Touched counter, Dream Board, morning
  message from Leah, and more.

## Why this matters

The Practice exists so people feel better in their life, not just have a life that looks good from the
outside. Joy is accessible even in challenge and struggle. The way we welcome, follow up with, and
celebrate members is part of that message. When the team can see the movement growing in real time and
feels the win each time a task gets done, the energy shows up in how we treat every member.

## 1. Team Board

The home screen for the team. Each person logs in and sees their lane first, then the whole team.

- **Roles and responsibilities page**: who owns what (Leah, Logan, Abra, Amy, Michelle, Christina), so
  nobody has to ask who handles a member question, a refund, or a Discord post.
- **Task list** with owner, due date, and status. Recurring tasks repeat on their own (example: Monday,
  Wednesday, and Friday Discord posts; the daily Rep of the Day; monthly Masterclass prep).
- **Checkoff celebration**: confetti when a task is checked, using the same monthly seasonal theme as
  the app (November leaves, December snowflakes, February hearts). A bigger burst when someone clears
  their whole list for the day.
- **Streaks and team progress bar**: how many days in a row each person has cleared their list, plus a
  weekly team bar that fills as tasks get done.
- **Shout outs**: a button to thank a teammate for a specific task, which also posts to Discord.

## 2. Live Pulse

A running feed of what members are doing, with a small sound and animation for the big moments.

| Event | Where it comes from | What the team sees |
| --- | --- | --- |
| New member joins (starts 7 day trial) | App sign up / payment system | "Welcome, Sarah from Denver!" plus count for today |
| Trial upgrades to full membership | Payment webhook (e.g. Stripe) | Gold celebration card, running monthly total |
| Merch purchase | Shop webhook | Item bought, so we can watch what sells |
| Gift subscription purchased | Shop or payment system | Holiday gift counter (hat plus one year) |
| Trial ending in 48 hours | Scheduled check | Shows on the board so someone can reach out |
| Member cancels | Payment webhook | Quiet alert, with a prompt to send a personal note |
| Referral converts | Referral code tracking | Credits the member and the team bonus pool |

Privacy note: show first name and city on the team feed and in Discord. Keep emails, phone numbers,
and payment details inside the admin view only.

## 3. Welcome Journey (automated)

Every new member gets a short series of messages so they feel welcomed, know where to start, and hear
about the merch. Draft copy is in the appendix.

| When | Channel | Message |
| --- | --- | --- |
| Right after sign up | Email + text | Welcome to the movement, a personal note from Leah, where to start |
| Day 1 | In app | Try today's Rep of the Day and ask the Practice Coach a starter question |
| Day 2 | Email | The merch: sport it, wear it, tag us |
| Day 4 | Email | Invite to the Lab, the Coaching Lab, and this month's Masterclass |
| Day 6 (trial ends tomorrow) | Email + text | What stays with you as a full member; a gentle invite to keep going |
| On upgrade | Email | Thank you, you are officially part of this; their referral link |
| On merch order | Email | Thank you, tag us when you wear it so we can share you |
| Quiet for 10 days | Email | We miss you, plus one simple rep to come back to |

Texting needs opt in at sign up (a checkbox) and a business texting registration with the carrier
service, which can take a couple of weeks. Worth starting that paperwork early.

## 4. Discord Bridge

- A **#wins** channel where the bot posts new members, upgrades, merch orders, and team checkoffs.
- A private **#team-board** channel for task updates and shout outs.
- Slash commands so the team can work from Discord: `/done` to check off a task, `/tasks` to see
  today's list, `/shoutout` to thank someone.
- Optional: automatically post Leah's Monday, Wednesday, and Friday messages on schedule once she
  approves them in the Command Center.
- Optional: new members who connect Discord get a welcome message and a member role.

## 5. Rewards

### Team bonus pool

A shared goal everyone can see, so the whole team wins together. Some ideas to choose from:

- A set amount goes into the pool for each trial that upgrades. When the team hits the monthly goal,
  the pool pays out evenly.
- Milestone rewards: first 100 members, first 500, first $10K month. Each one unlocks a team dinner, a
  bonus, or a day off.
- Quarterly recognition for the person with the most shout outs from teammates.

### Member referral program

- Each member gets a personal link and code inside the app.
- Give a month, get a month: the friend gets a longer trial or a discount, and the member gets a free
  month once the friend upgrades.
- Merch rewards at levels: 3 referrals earns a hat, 5 earns a hoodie, 10 earns a call with Leah or a
  spot in a special Coaching Lab.
- A leaderboard and badges inside the app, with the same confetti moment when a referral converts.

## 6. Scoreboard

A simple top row of numbers on the Command Center home screen:

- New trials this week and this month
- Trial to paid conversion rate
- Active paying members and monthly recurring revenue
- Merch revenue and top selling items
- Members who used the app in the last 7 days
- Referrals sent and converted
- Team tasks completed this week

## Build plan

| Phase | What gets built | Why first |
| --- | --- | --- |
| Phase 1 (before the Christmas merch launch) | Live Pulse, Discord #wins posts, welcome email, merch thank you email, gift purchase tracking | Captures the holiday traffic and starts the dopamine hits right away |
| Phase 2 (December) | Team Board with roles, recurring tasks, checkoffs, confetti, streaks; Discord slash commands; full welcome series | Gets the team running the work from one place |
| Phase 3 (January 2027) | Referral program, team bonus pool, scoreboard, text messages | Lines up with the 2027 push to invite more people into The Practice |
| Phase 4 (February to March 2027) | Keep the Dream Alive: the nine features below | Builds on the data from Phases 1 to 3, so it goes last |

## Phase 4: Keep the Dream Alive

These features keep the mission in front of the team every day, so the work feels like a movement and
not just a to do list. Time estimates are rough guesses for one developer and are for Logan to confirm.

| Feature | What it does | Build notes | Rough time |
| --- | --- | --- | --- |
| Movement Map | A map that lights up with a dot each time someone joins. Watch the movement spread city by city. | Needs a city for each member: ask for it at sign up or look it up from the payment address. City level only, no exact locations. | 2 to 3 days |
| Lives Touched counter | One big number on the home screen: members, reps completed, Practice Coach conversations, Lab sessions attended. | Counts data the app already has. | 1 day |
| What members are working on | Weekly trending themes from Practice Coach conversations, like confidence or hard conversations. Also guides what to teach next. | Themes only, as totals. The team never sees anyone's actual conversation. Mention this use in the privacy policy. | 4 to 6 days |
| Dream Board | Leah's 2027 vision, big goals, and mission on the home screen, with live progress bars toward each goal. | Leah edits the goals herself. Progress bars pull from the scoreboard numbers. | 2 days |
| Milestone countdown | "38 members away from 500." Hitting a milestone sets off a full screen celebration and a Discord post. | Uses the same confetti as the Team Board. | 1 to 2 days |
| Morning message from Leah | A short daily note or voice clip from Leah for the team, the same way members get the Rep of the Day. | Leah records or types it in the Command Center, schedules it, and it shows on the home screen and posts to Discord. | 1 to 2 days |
| Member moments | Automatic notes on a member's 30 day, 90 day, and one year anniversaries, plus birthdays. The team sees them coming up. | Birthday needs an optional field at sign up. Uses the same email system as the Welcome Journey. | 2 days |
| Tagged in merch | A gallery of members wearing the gear. Great for team energy and for social content. | Simplest path: members upload a photo in the app, or the team pulls tagged posts from Instagram. Team approves each one, and members give permission to share. | 3 to 5 days |
| Gratitude wall | Teammates thank each other. Every Friday the bot posts the week's thanks to Discord. | Builds on the shout out button from the Team Board. | 1 to 2 days |

**Total for Phase 4:** roughly 17 to 25 working days, or about four to five weeks if Logan is building
close to full time on it. Spread across his other work, plan on February through March 2027.

**Suggested order:** Lives Touched counter, Milestone countdown, and Morning message first (quick wins,
about a week together). Then the Dream Board, Movement Map, Gratitude wall, and Member moments. Save
What members are working on and Tagged in merch for last, since they take the most care.

## Possible tools (Logan's call)

- Events: webhooks from the payment system (Stripe or whatever the app uses) and the merch shop
- Database and team login: whatever the app already runs on, or Supabase
- Email: Resend, Postmark, or the email tool already in use
- Text: Twilio
- Discord: a small bot plus channel webhooks
- Confetti: canvas confetti, reusing the app's seasonal shapes

## Decisions for Leah and Logan

- Which roles and recurring tasks go on the board first
- Bonus pool amounts and the first monthly goal
- Referral reward: free month, merch, or both
- Whether messages come from Leah personally or from The Practice
- Which Instagram handle members should tag

## Appendix: draft welcome messages

Written in Leah's voice. Edit freely, especially the personal story line. These are the words in
`api/_lib/words.js`.

### Welcome email (right after sign up)

**Subject:** Welcome to The Practice

Hi {first name},

Thank you for coming into The Practice. We are so glad you are here, and we welcome you into this
community.

This movement means so much to me. There was a time I borrowed belief because I could not find my own
yet. Now I get to share my belief with you.

Here is what I believe: you deserve to feel better in your life, not just have a life that looks good.
Joy is accessible, even in challenge and even in struggle. That is what we practice here.

A great place to start: open today's Rep of the Day, then ask the Practice Coach one question that is
on your mind.

And check out the merch. Sport it, wear it, and tag us so we can celebrate you.

Thank you for being part of this movement.

With love,
Leah

### Welcome text

Hi {first name}, it's Leah! Thank you for joining The Practice. You are part of this movement now and I
am so glad you are here. Start with today's Rep of the Day: {link}. Reply STOP to opt out.

### Merch email (day 2)

**Subject:** Wear the movement

Hi {first name},

When you wear The Practice, you are telling people you chose to feel better in your life. That starts
conversations.

Check out the shop: {link}. When it shows up, sport it, wear it, and tag us. We love sharing our
members.

Leah

### Upgrade thank you

**Subject:** You are officially in

Hi {first name},

Thank you for choosing to keep going. You are officially part of The Practice, and that means a lot
to me.

Know someone who could use this too? Here is your personal link: {referral link}. When they join, you
both get a gift from us.

So grateful for you,
Leah

### Merch order thank you

Thank you for your order, {first name}! When it arrives, wear it proud and tag us. We cannot wait to
see you in it.
