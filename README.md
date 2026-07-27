# Junti

**Quién viene y quién ya pagó.**

A small tool for a group of friends who organize recurring informal events —
pickup football, padel, birthday parties, kids' parties. It solves exactly two
problems the organizer always has:

1. Not knowing who is actually coming until the last minute.
2. Fronting the cost and then chasing people for the money.

That's it. It is not a marketplace, not a ticketing platform, and **it never
touches money** — the organizer records payments by hand. The app is a ledger,
not a payment rail.

- **No accounts, no login, no passwords.** Access is by unguessable URL only.
- **Mobile-first.** Designed at 390px, because every user opens it from a
  WhatsApp link on a phone.
- **Costs USD 0/month to run.** See [COSTS.md](./COSTS.md).

> The product name is not final. It lives in exactly one module,
> `src/config/brand.ts` — renaming is one commit, not a migration.

---

## How it works

| Who                   | Link                                         | Can do                                                                                                       |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Everyone in the group | `/e/<public_token>`                          | See the roster and the money, RSVP, amend their own RSVP                                                     |
| The organizer         | `/e/<public_token>/manage/<organizer_token>` | All of the above, plus mark payments, add/remove people, promote from the waitlist, edit and close the event |

Both tokens are generated with `crypto.randomBytes`. **The links are the
authentication.** There is no account recovery — if the organizer loses their
link, they lose control of the event. The app says so, loudly, on the page where
the link is first shown.

---

## Prerequisites

- **Node.js 20.9+** (Next.js 16 minimum).
- **A Supabase project** on the free tier — used purely as managed Postgres.
- **`psql` / `pg_dump`** for backups (`brew install libpq` on macOS). The
  `pg_dump` major version must be **>= your database's** or it refuses to run.
- **Access to the private `@stackmyth/*` packages.** The UI layer is published to
  GitHub Packages, not npmjs, so `npm install` fails without it. Create a
  classic GitHub token with the `read:packages` scope, then:

  ```ini
  # ~/.npmrc  (or a project-local .npmrc)
  @stackmyth:registry=https://npm.pkg.github.com/
  //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
  ```

  ```bash
  export NODE_AUTH_TOKEN=ghp_your_token_here   # never commit the literal value
  ```

---

## Local setup

**1. Install dependencies**

```bash
npm install
```

**2. Create the Supabase project**

In the [Supabase dashboard](https://supabase.com/dashboard): New project → pick
a region close to you → save the database password somewhere safe, you cannot
read it again later.

**3. Configure the environment**

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in both connection strings. Find them under
**Project Settings → Database → Connection string**. You need _both_, and they
are different:

| Variable              | Port     | Mode                           | Used by                   |
| --------------------- | -------- | ------------------------------ | ------------------------- |
| `DATABASE_URL`        | **6543** | Transaction (Supavisor pooler) | The running app           |
| `DIRECT_DATABASE_URL` | **5432** | Session (direct)               | `db:migrate`, `db:export` |

This split is not optional. Vercel runs serverless functions and each cold start
wants its own connection, while Supabase's direct connection limit is small — so
runtime traffic must go through the pooler. But transaction-mode pooling does
not support prepared statements or session state, so migrations and `pg_dump`
must use the direct connection. The driver is already configured with
`prepare: false` in `src/db/client.ts`; without it you get intermittent failures
under concurrency that look exactly like application bugs.

Neither variable may ever be prefixed `NEXT_PUBLIC_`. They are credentials.

**4. Run the migrations**

```bash
npm run db:migrate
```

Migrations live in `./drizzle` and are checked into the repo — never run DDL
from the Supabase SQL editor, or the schema history stops matching the code.

**5. Start the app**

```bash
npm run dev
```

Open <http://localhost:3000>.

### Developing without Supabase

Any Postgres works — nothing in the schema is Supabase-specific. A throwaway
container is the fastest path:

```bash
docker run -d --name event-roster-pg \
  -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=event_roster \
  -p 55432:5432 postgres:15-alpine
```

Then point both URLs at `postgresql://postgres:devpassword@127.0.0.1:55432/event_roster`.
There is no pooler locally, so they are the same string. Match the Postgres
major version to your local `pg_dump` so `npm run db:export` works.

---

## Deploying to Vercel

1. Push the repository to GitHub.
2. In Vercel: **Add New → Project**, import the repo. The framework is detected
   automatically; no build settings to change.
3. Under **Settings → Environment Variables**, add:
   - `DATABASE_URL` — the **pooled** string (port 6543)
   - `NODE_AUTH_TOKEN` — your `read:packages` token, so the build can install
     the private `@stackmyth/*` packages
   - Also commit an `.npmrc` with the `@stackmyth` scope line (the token line
     can stay as `${NODE_AUTH_TOKEN}`), or the install step won't know where to
     look.

   `DIRECT_DATABASE_URL` is **not** needed in Vercel — the app never opens that
   connection. Keep it local.

4. Deploy.
5. Run migrations against production from your machine, with
   `DIRECT_DATABASE_URL` pointing at the production database:

   ```bash
   npm run db:migrate
   ```

6. Set up the keep-alive — see the next section. **Do not skip this**, or the
   app will be down the next time somebody opens it after a quiet fortnight.

Deliberately **not** used, to stay inside the free tier: Next.js Image
Optimization, Vercel Analytics, Speed Insights, and edge middleware. Everything
runs on Node runtime defaults.

---

## Keeping it alive

This section exists because the person who has to fix this in six months will
not remember any of it. Read it now, not then.

### The problem

**Supabase pauses free projects after about 7 days of inactivity.** A paused
project is completely unreachable until somebody logs into the dashboard and
restores it by hand. This app is used sporadically — a match every couple of
weeks — so without intervention it _will_ be down when somebody opens the link.

### The fix

Two pieces, both already in the repo:

1. **`/api/keep-alive`** — writes one row to a `heartbeat` table and returns 200. No auth (the cron has no credentials), but rate-limited to 12 requests
   per minute per IP and marked `noindex`.

2. **`.github/workflows/keep-alive.yml`** — a scheduled GitHub Action that hits
   that route every two days, retrying three times to absorb a cold start.

GitHub Actions rather than Vercel Cron: Hobby cron is limited in frequency and
count, and Actions is free and more flexible.

### Turning it on

Set one repository variable:

**Settings → Secrets and variables → Actions → Variables → New variable**

- Name: `APP_URL`
- Value: `https://your-app.vercel.app` (no trailing slash)

Then verify it works without waiting two days: **Actions → Keep database awake
→ Run workflow**. It should go green and print `{"ok":true,...}`.

### ⚠️ The failure mode behind the failure mode

**GitHub disables scheduled workflows after ~60 days of repository inactivity.**
It emails the repo owner when it does, and that email is easy to miss.

So the full chain is: nobody commits for two months → GitHub silently stops the
schedule → seven days later Supabase pauses the database → the app is down, and
the thing that was supposed to prevent it is also off.

If that happens:

1. Supabase dashboard → restore the project (takes a few minutes).
2. GitHub → Actions tab → re-enable the workflow, **or** push any commit.

A calendar reminder to push a trivial commit every couple of months is a
perfectly reasonable defence.

---

## Backups

**The Supabase free tier has zero backup retention.** There is no snapshot, no
point-in-time recovery, and no support ticket that will get your data back.
Nobody else is backing this up. If you drop the database, it is gone.

```bash
npm run db:export
```

Writes a timestamped `.sql` dump to `./backups/` (git-ignored) using `pg_dump`
over the direct connection. Run it before anything risky, and occasionally
otherwise. Keep a copy somewhere that is not your laptop.

If it fails with a server version mismatch, your local `pg_dump` is older than
the database. Check the server version under **Project Settings →
Infrastructure** and install a matching client:

```bash
brew install postgresql@17 && brew link --overwrite --force postgresql@17
```

---

## Commands

| Command               | What it does                         |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Development server                   |
| `npm run build`       | Production build                     |
| `npm run lint`        | ESLint                               |
| `npm run typecheck`   | `tsc --noEmit`                       |
| `npm test`            | Vitest — the domain logic            |
| `npm run format`      | Prettier                             |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate`  | Apply migrations (direct connection) |
| `npm run db:export`   | `pg_dump` to `./backups/`            |

---

## Project layout

```
src/
  app/                       Routes. No "junti" in any path.
    page.tsx                 Landing
    new/                     Create an event
    e/[public_token]/        Participant view + RSVP
      manage/[organizer_token]/   Organizer view
    api/keep-alive/          Free-tier heartbeat
    stackmyth-smoke/         UI-layer integration check (noindex, unlinked)
  components/                Shared UI, composed from Stackmyth primitives
  config/
    brand.ts                 THE ONLY place the product name lives
    copy.ts                  Every user-facing string, in Spanish (es-CO)
    env.ts                   Zod-validated server environment
  db/                        Drizzle schema + client
  domain/                    Pure business rules. No framework, no DB. Tested.
    split.ts                 Cost splitting
    waitlist.ts              Capacity and waitlist ordering
  lib/                       Server-side helpers (tokens, formatting, roster)
drizzle/                     Checked-in SQL migrations
```

**Code, comments, identifiers, SQL and docs are in English. All user-facing UI
copy is in Spanish (es-CO)** and lives in `src/config/copy.ts` — no i18n
library, just one swappable module.

`src/domain/` is the only part worth isolating and the only part with tests. It
is where the real rules live: how a total splits without losing a cent, and who
gets a spot when one opens up.

---

## The rules that matter

These are implemented precisely and unit-tested (59 tests, `npm test`).

**Splitting**

- `none` — no payment rows, no money UI anywhere.
- `per_person` — everyone attending owes the full amount.
- `total` — split evenly across attending participants. Integer division, with
  the remainder handed out one minor unit at a time to the earliest joiners, so
  the shares sum to **exactly** the total. No cent is ever lost or invented.
- People who are out, maybe, or waitlisted owe nothing.
- Shares recompute whenever the roster or the cost changes — **except for a
  confirmed payment, which is never recomputed.** That money already changed
  hands. If the split moves afterwards, the confirmed amount stands and the
  difference is surfaced to the organizer as a warning. It is never silently
  reconciled.
- COP has no practical minor unit, so amounts display as whole pesos with
  thousands separators and no decimals: `$ 41.667`.

**Waitlist**

- Ordered by join time, earliest first.
- At capacity, a new "I'm coming" becomes `waitlisted`, and the UI says so
  plainly.
- **When a slot frees up, nobody is promoted automatically.** The organizer is
  shown that a slot opened and promotes explicitly. Silent promotion means
  somebody shows up thinking they aren't playing — or doesn't show up because
  nobody told them they were.

---

## Security model

There are no accounts, so this is the whole of it:

- Both tokens come from `crypto.randomBytes`, base64url — 96 bits for the
  participant link, 192 bits for the organizer link. Never `Math.random`, never
  sequential.
- **The organizer token is never sent to the client on a participant route** —
  not in HTML, not in JSON, not in a server-component payload. The participant
  page loads a view type that has no such field, so it cannot leak by accident.
- Every mutation re-validates the token pair against the database, server-side,
  on every call. Being on the manage page is not itself proof of anything.
- All event pages are `noindex, nofollow`.
- Event creation and RSVP are rate-limited by IP.

### On the database

Supabase is used **only** as managed Postgres. There is deliberately no
`@supabase/supabase-js`, no Supabase Auth, no Row Level Security, no anon or
service-role key, and no query issued from the browser. Drizzle connects
straight to Postgres from server code.

RLS was skipped on purpose, not overlooked: access control here is
token-based and enforced in server actions. Expressing "the holder of this
opaque token may read these rows" as a database policy is both harder and easier
to get wrong, and since there is no browser-side database access there is
nothing for RLS to protect. It would be complexity for the appearance of
security.

### On rate limiting

The limiter is an in-memory map (`src/lib/rate-limit.ts`). The zero-cost
constraint rules out Redis, and on Vercel each serverless instance keeps its own
counter — so the effective limit is the configured one times the number of warm
instances. That is fine for what it defends against: somebody bored hammering a
form. It is **not** a defence against a distributed attack and does not pretend
to be one.

---

## The UI layer

The interface is built entirely from **Stackmyth**, a first-party component
stack. Two documents came out of using it:

- **[STACKMYTH-NOTES.md](./STACKMYTH-NOTES.md)** — the verified inventory of
  what is installed and how to use it, written by reading the packages'
  TypeScript declarations. If a component isn't in there, it isn't used here.
- **[STACKMYTH-GAPS.md](./STACKMYTH-GAPS.md)** — a blunt friction log from
  adopting the stack cold, including the one issue that cost real debugging
  time. Every `// STACKMYTH-GAP:` comment in the codebase has an entry there.

`/stackmyth-smoke` renders one of each primitive the app uses. It is unlinked
and `noindex`, and it is the cheapest way to check the UI layer still integrates
after a version bump.

---

## Also in this repo

- **[DECISIONS.md](./DECISIONS.md)** — every judgement call made while building
  this, and why.
- **[COSTS.md](./COSTS.md)** — what this costs today and what would break that.
