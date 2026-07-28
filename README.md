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

- **No passwords, ever.** Participants need no account at all — access is by
  unguessable URL. Signing in is optional, and buys two things: a history of the
  events you organized, and joining someone else's in a single tap.
- **Mobile-first.** Designed at 390px, because every user opens it from a
  WhatsApp link on a phone.
- **Spanish and English**, switchable per reader. Every event carries its own
  time zone, so the group all read the same clock.
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

Signing in adds one page on top of that, `/mis-eventos`: the events you created
while signed in, newest first. It is a convenience — a way to find a link you
mislaid — and it grants nothing the organizer link does not already grant. An
event created while signed out belongs to nobody and will never appear there,
which is the honest consequence of not having required an account.

It also removes the form. Someone already signed in who opens an event link gets
a single button with their own name and photo on it: one tap and they are on the
list. The RSVP form exists because an anonymous participant has to introduce
themselves, and a signed-in one already has.

---

## Requirements before someone counts as confirmed

An event can ask for things. Say the pitch costs 120,000 and you fronted it: add
a **Proof of payment** requirement, and anyone who says they are coming has to
upload a photo of the transfer. Until you approve it they are on the list but
**not confirmed** — they appear in a separate, collapsed section labelled with
whatever you called the requirement.

Two kinds, and the difference is who decides:

| Kind                  | The participant does | Confirmed when                  |
| --------------------- | -------------------- | ------------------------------- |
| **Proof of payment**  | Uploads a photo      | You approve it                  |
| **Read and accepted** | Ticks a box          | Immediately — nothing to review |

Ticking a box is its own proof. A receipt is a claim about the world, so a human
looks at it; if uploading any image confirmed you, the requirement would be
checking that people own cameras.

The kind of event only decides what gets **suggested** — a match proposes proof
of payment, a kids' party proposes an acknowledgement. Everything is added by an
explicit tap, renameable, and removable. Five per event, maximum.

### Adding a kind of event, or a new requirement

Both live in the database, not in the code. Three tables:

| Table                 | Holds                                             |
| --------------------- | ------------------------------------------------- |
| `event_types`         | Match, Party, Kids' party, Other…                 |
| `policy_definitions`  | The requirements that exist, and how each behaves |
| `event_type_policies` | Which requirements each kind of event offers      |

So a new kind of event is one row:

```sql
insert into event_types (id, slug, labels, position)
values (gen_random_uuid(), 'tournament', '{"es":"Torneo","en":"Tournament"}', 4);
```

It appears in the create form immediately, in both languages, with no deploy.
Same for a new requirement that behaves like an existing one — a registration
receipt is another "upload a photo and the organizer approves it":

```sql
insert into policy_definitions (id, slug, handler, labels, descriptions, position)
values (gen_random_uuid(), 'registration_receipt', 'file_upload_reviewed',
        '{"es":"Comprobante de inscripción","en":"Registration receipt"}',
        '{"es":"Sube el soporte de la inscripción.","en":"Upload the registration slip."}', 2);
```

Then attach it to the types that should offer it — `is_default` decides whether
the create form starts with it already added or merely offers it:

```sql
insert into event_type_policies (event_type_id, policy_definition_id, position, is_default)
select t.id, d.id, 0, true
  from event_types t, policy_definitions d
 where t.slug = 'tournament' and d.slug = 'registration_receipt';
```

**Retire, do not delete.** Set `is_active = false` to take something out of the
picker. Both foreign keys are `ON DELETE RESTRICT`, so a `DELETE` on a row that
events are using fails rather than taking those events with it — and existing
events keep showing a requirement even after it is retired.

There is no admin screen yet: this is SQL or the Supabase table editor.

### What a row cannot do: `handler`

`policy_definitions.handler` is a **key into a registry in the code**, not a
description of behaviour. A row cannot ship a file input, an image resizer, a
byte sniffer and a review screen, so:

| You want                                                | Cost           |
| ------------------------------------------------------- | -------------- |
| A requirement that behaves like an existing one         | **one row**    |
| A genuinely new behaviour (signature, QR, payment link) | code + one row |

The handlers that exist today are `file_upload_reviewed` and
`self_acknowledged`. Adding one means three things that have to agree, which is
also why the behaviour is not defined in the component alone — if it were, the
server would have to trust the client about what to validate:

1. an entry in `src/domain/policy-handlers.ts` — who settles it, what evidence
   it needs;
2. a control in the participant panel (`src/app/e/[public_token]/policy-panel.tsx`);
3. whatever the submission action must accept for it.

A row naming a handler that does not exist in the running build does **not**
block anyone. It is shown to the organizer as a warning and otherwise ignored,
because stranding participants over an operator error is worse than a policy
that quietly does nothing.

### What a requirement does not do

It does not free the spot and it does not change the money. Someone who has not
paid yet still occupies their place and still owes their share. The alternative
— reopening the spot until they pay — would mean the waitlist promotes over
somebody who already believes they are coming, and the roster quietly overbooks
every time a payment is slow. Being confirmed is about how sure the organizer
is, and that is a display question.

### Receipts are private, and where they live

A payment screenshot carries a full name, a phone number and a bank. **Only the
organizer can open one**, through a single route behind the organizer token; it
never appears on the participant page the whole group chat can see.

The image is shrunk in the browser to 1400px and JPEG quality 0.8 before it is
uploaded — a 3 MB screenshot arrives as ~150 KB — and stored in Postgres rather
than in a bucket. That is a deliberate trade for one reason: the free tier keeps
no backups, so `pnpm db:export` is the only copy that exists, and bytes in a
table are inside it while bytes in a bucket are not. It is also the only thing
in this app that consumes storage at any rate; [COSTS.md](./COSTS.md) says where
the ceiling is and what crossing it costs.

---

## Languages and time zones

The interface is in **Spanish and English**. The switcher is on every page, the
choice is remembered for a year, and it follows the reader — cookie first, then
the browser's `Accept-Language`, then the language the event was created in.

**Nothing anyone typed is ever translated.** Titles, notes, names and the labels
you give your own requirements are stored and shown exactly as written. A
friend's "Llevar guayos" stays that way on an English page, because the
alternative is machine-translating a message from someone the reader knows.

### How each default is chosen

Both follow the same shape: **the browser decides, unless you have said
otherwise.**

| Setting       | Order                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| **Language**  | your saved setting → your browser's `Accept-Language` → the event's language → Spanish |
| **Time zone** | your saved setting → your device's zone → the event's own zone                         |

Region subtags are ignored — `es-CO`, `es-419` and `es` all resolve to Spanish.

The event's own language is only a fallback for a browser asking for something
the app does not speak; better to show a French reader an event's English than
to default them to Spanish.

The time zone cannot be detected on the server — asking there returns the
_server's_ zone, which is UTC on Vercel. So the browser writes it into a cookie
the first time you arrive, and every page after that renders on the right clock
server-side.

### Your profile

Signed in, `/perfil` sets both. Each has an automatic option at the top — "the
one my browser uses" — and that is the default. Picking a real value turns the
override on; picking the automatic option turns it off. There is no separate
switch, because a value and a switch are two things that can disagree.

It is stored on your account, so it follows you to a new phone: at sign-in the
saved setting is copied onto that device.

### Reading times across zones

Times are shown **in your zone, with the place always named**, and when the
event is somewhere else you see both:

```
Cuándo
domingo, 2 de agosto de 2026, 3:00 a. m. · hora de Madrid
En Bogota: sáb, 1 de ago, 8:00 p. m.
```

Naming the zone is not decoration — it is what makes conversion safe. A bare
"3:00 a.m." on a page two friends read in different countries is how a group
ends up disagreeing about when the match is. In the event's own zone, which is
the usual case, there is just the one line.

**Everything is stored in UTC.** `events.time_zone` is not a time: it records
which wall clock the organizer meant, which a UTC instant alone cannot recover
— 01:00Z is 8 p.m. in Bogotá and 9 p.m. in Santiago. That column is what lets
the second line exist.

Adding a third language is one file: copy `src/config/copy/es.ts`, translate it,
add a line to `src/config/copy/index.ts`. The compiler will not let the new file
be missing a key.

---

## Prerequisites

- **Node.js 20.9+** (Next.js 16 minimum).
- **pnpm 10+.** This project uses pnpm — `packageManager` in `package.json`
  pins it, so `corepack enable` is enough. There is deliberately only one
  lockfile; see the note below.
- **A Supabase project** on the free tier — managed Postgres, plus Auth if you
  want organizer sign-in.
- **`psql` / `pg_dump`** for backups (`brew install libpq` on macOS). The
  `pg_dump` major version must be **>= your database's** or it refuses to run.
- **Access to the private `@stackmyth/*` packages** — see next section.

### Authenticating to GitHub Packages

The UI layer is published privately to GitHub Packages, not npmjs, so a fresh
`pnpm install` cannot fetch it without a credential.

The committed `.npmrc` carries only the scope→registry mapping, which is safe.
**The token is not in it, and must not be**: pnpm refuses to expand environment
variables in auth lines coming from a project-level `.npmrc`, precisely because
that file is committed. npm _would_ expand it — so keeping it there would work
under npm and silently fail under pnpm, which is worse than not having it.

Create a classic GitHub token with the `read:packages` scope, then put it
somewhere the installer trusts:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" ghp_your_token_here
```

or add it to your user-level `~/.npmrc` by hand:

```ini
@stackmyth:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=ghp_your_token_here
```

Verify with `pnpm install`. It should finish without warnings.

### Why `pnpm install` warns about ignored builds — and why it no longer does

pnpm blocks dependency build scripts by default, because a `postinstall` runs
arbitrary code on your machine. Out of the box it reports:

```
ERR_PNPM_IGNORED_BUILDS: esbuild, sharp, unrs-resolver
```

Despite the `ERR_` prefix this is a notice, not a failure — but the packages
are installed _unbuilt_, which breaks them later and confusingly. The decisions
are recorded in `pnpm-workspace.yaml`: `esbuild` and `unrs-resolver` are
allowed (drizzle-kit/vitest and the ESLint resolver need them), `sharp` is
not — it exists only for Next.js Image Optimization, which this project does
not use. If you ever see that message again, a dependency added a new build
script and it wants an explicit decision, not a blanket `pnpm approve-builds`.

---

## Local setup

**1. Install dependencies**

```bash
pnpm install
```

**2. Create the Supabase project**

In the [Supabase dashboard](https://supabase.com/dashboard): New project → pick
a region close to you → save the database password somewhere safe, you cannot
read it again later.

**3. Configure the environment**

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the database fields. Find them under
**Project Settings → Database → Connection string**, with _Display connection
pooler_ ticked.

| Variable         | Meaning                            |                           |
| ---------------- | ---------------------------------- | ------------------------- |
| `DB_HOST`        | `aws-0-REGION.pooler.supabase.com` |                           |
| `DB_USER`        | `postgres.YOUR_PROJECT_REF`        |                           |
| `DB_PASSWORD`    | **Verbatim.** Never escape it.     |                           |
| `DB_NAME`        | `postgres`                         |                           |
| `DB_PORT`        | **6543** — transaction pooler      | The running app           |
| `DB_DIRECT_PORT` | **5432** — session mode            | `db:migrate`, `db:export` |

Discrete fields rather than one URL, because a connection URI reserves
`@ # % : / ?` and Supabase generates passwords containing exactly those — a
password pasted into a URL unescaped parses into the wrong host and fails with a
misleading authentication error. Here the driver receives the password as its
own field, so rotating it is a paste and nothing else. A single `DATABASE_URL`
is still accepted as a fallback for platforms that only hand you one string; if
both are present the discrete fields win. See `src/config/db-connection.ts`.

The two ports are not optional either. Vercel runs serverless functions and each
cold start wants its own connection, while Supabase's direct connection limit is
small — so runtime traffic must go through the pooler. But transaction-mode
pooling supports neither prepared statements nor session state, so migrations
and `pg_dump` must use the direct port. The driver is already configured with
`prepare: false` in `src/db/client.ts`; without it you get intermittent failures
under concurrency that look exactly like application bugs.

None of these may ever be prefixed `NEXT_PUBLIC_`. They are credentials.

**4. Configure organizer sign-in** _(optional locally)_

```ini
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

From **Project Settings → API**. These two _are_ public: the publishable key
identifies the project and grants no data access here, because Supabase Auth is
used for identity only and every read and write still goes through Drizzle from
server code. Skip them and the app runs fine — sign-in is what stops working.
Setup is under [Organizer accounts](#organizer-accounts) below.

**5. Run the migrations**

```bash
pnpm db:migrate
```

Migrations live in `./drizzle` and are checked into the repo — never run DDL
from the Supabase SQL editor, or the schema history stops matching the code.

**6. Start the app**

```bash
pnpm dev
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

Then set `DB_HOST=127.0.0.1`, `DB_USER=postgres`, `DB_PASSWORD=devpassword`,
`DB_NAME=event_roster` and both ports to `55432` — there is no pooler locally,
so the two are the same. TLS switches itself off for localhost. Match the
Postgres major version to your local `pg_dump` so `pnpm db:export` works.

---

## Organizer accounts

Organizers can sign in to get a history of their events, newest first, with
their Google profile photo. **Participants still need no account** — the RSVP
flow is unchanged, and creating an event without signing in still works.

Two passwordless routes:

- **Google** — the only one that yields a profile photo, which is why the
  feature exists.
- **Email magic link** — for anyone without a Google account.

Signing in with both, using the same verified address, lands on **one account**:
Supabase links the identities automatically, so the history is the same either
way.

### Supabase setup

1. **Authentication → Providers → Google**: enable it and paste a Client ID and
   Secret from Google Cloud Console.
2. In Google Cloud Console (**APIs & Services → Credentials**, OAuth client of
   type _Web application_), the **Authorized redirect URI** is Supabase's, not
   this app's:

   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   One entry covers every environment. Localhost does **not** need its own —
   Google only ever redirects to Supabase, which then redirects back to
   whichever origin started the flow.

3. **Authentication → URL Configuration**: set `Site URL` to production, and add
   every origin that may start a sign-in to the redirect allow list:

   ```
   https://your-app.vercel.app/auth/callback
   https://your-app.vercel.app/**
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   http://localhost:3001/**          # next dev falls back here when 3000 is taken
   ```

### Publish the Google app, or only you can sign in

Under **Google Auth Platform → Audience**, publishing status must be
**In production**. A new project starts in **Testing**, where only listed test
users can sign in — and the trap is that the project's own owner is allowed
implicitly, so sign-in appears to work perfectly for the person who set it up
and fails for everyone else. Testing also expires refresh tokens after 7 days.

Publishing is one button and needs no review here, because the app requests only
`openid email profile`: all three consent-screen scope tables — non-sensitive,
sensitive, restricted — are empty, and the 100-user cap applies only to
unapproved sensitive or restricted scopes. Adding a scope later is what would
change that.

### Two failure modes worth recognising

- **`redirect_uri_mismatch` from Google** — the Supabase callback is missing
  from the Google client's authorized URIs. Blocks every environment at once,
  since that URI is environment-independent.
- **"This browser or app may not be secure"** — Google refuses OAuth in
  automated browsers and in the in-app browsers of WhatsApp, Instagram and
  friends. Not fixable from the app; the user opens the link in a real browser,
  or signs in by email instead.

### Email limits

Without custom SMTP, Supabase's built-in mailer allows roughly **2–3 emails per
hour**. Fine for testing, not for real use. Configuring SMTP is the moment to
re-read [COSTS.md](./COSTS.md).

---

## Deploying to Vercel

### Shipping a change

**Pushing to `main` is the deploy.** Vercel is connected to the GitHub repo and
builds every push; there is no CLI step and nothing to run by hand.

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # the gate
git push origin main                                     # this is the deploy
```

What Vercel does **not** do is run migrations. It runs `next build`, nothing
else — so a schema change is a separate act, from your machine:

```bash
pnpm db:migrate
```

### The one thing to keep in mind: there is a single database

Your laptop and production talk to the **same** Supabase project. There is no
staging copy. Two consequences, and the second is the one that bites:

- A migration you run locally has changed production **immediately**, before
  any deploy exists.
- A **preview deployment** — any branch you push — also points at the
  production database, because the environment variables are set for all three
  environments. A preview is not a sandbox. Treat anything it writes as real.

### The order to do things in

It depends entirely on whether the migration only **adds**:

**Additive** — a new table, a new nullable column, a new index. Migrate first,
then push. Old code ignores what it does not know about, and new code finds it
already there. No window where anything is broken.

```bash
pnpm db:migrate && git push origin main
```

**Destructive** — dropping or renaming a column, or making an existing one
`NOT NULL`. There is no safe single step: migrate first and the live old code
hits a schema it does not expect; push first and the new code hits the old
schema. Split it across two deploys instead:

1. **Expand.** Add the new shape, backfill it, deploy code that writes both and
   reads the new one. Nothing is removed yet.
2. **Contract.** Once that is live and correct, a second migration drops the old
   shape, and a second deploy removes the code that touched it.

`drizzle/0003_catalogues.sql` and `0004_retire_kind_enums.sql` in this repo are
exactly that pair: 0003 added `event_type_id` alongside `kind` and backfilled
it; 0004 dropped `kind` afterwards.

**Before any destructive migration, take a backup.** The free tier keeps none,
so this is the only copy that will exist:

```bash
pnpm db:export
```

### Rolling back

Code rolls back; schema does not.

- **Code** — `git revert <sha> && git push`, or promote a previous deployment
  from the Vercel dashboard.
- **Schema** — Drizzle has no down-migrations here. Undoing one means writing
  the reverse by hand, or restoring the dump from `db:export`. This asymmetry
  is the real reason to prefer the expand/contract split above.

### Changing an environment variable

Editing one in Vercel does **not** affect the running deployment. Redeploy
afterwards — an empty commit is enough, or use **Redeploy** in the dashboard.

---

### First-time setup

1. Push the repository to GitHub.
2. In Vercel: **Add New → Project**, import the repo. The framework is detected
   automatically; no build settings to change.
3. Under **Settings → Environment Variables**, add:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` — the database
     fields from step 3 of the local setup. `DB_PORT` must be **6543**, the
     pooler.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — for
     organizer sign-in. Omit them and everything else still works; only the
     sign-in page breaks.
   - `NPM_RC` — the registry credential for the private `@stackmyth/*`
     packages. Vercel writes this variable's contents to `~/.npmrc` before
     installing, which is a location pnpm trusts. Two lines:

     ```ini
     @stackmyth:registry=https://npm.pkg.github.com/
     //npm.pkg.github.com/:_authToken=ghp_your_read_packages_token
     ```

     A bare `NODE_AUTH_TOKEN` is **not** enough on its own: pnpm will not
     expand it from the committed project `.npmrc`, so the install fails to
     authenticate.

     **Without this the build fails at install** with:

     ```
     ERR_PNPM_FETCH_401  GET https://npm.pkg.github.com/@stackmyth%2F...
     No authorization header was set for the request.
     ```

     That message means the scope mapping from the committed `.npmrc` was found
     but the token was not — i.e. `NPM_RC` is missing or has only the registry
     line. Set it for **Production, Preview and Development**, or preview
     deployments will keep failing after production starts working.

     The token is a personal one, so deploys depend on that person's account
     and stop the day it expires. For a team repo, a fine-grained token or a
     machine user with `read:packages` ages better.

   `DB_DIRECT_PORT` is **not** needed in Vercel — the app never opens the
   session-mode connection. Keep it local.

   Vercel detects pnpm from `pnpm-lock.yaml` and honours the `packageManager`
   field, so the install command needs no override.

4. Deploy.
5. Run migrations against production from your machine, with the `DB_*` fields
   in `.env.local` pointing at the production database:

   ```bash
   pnpm db:migrate
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
pnpm db:export
```

Writes a timestamped `.sql` dump to `./backups/` (git-ignored) using `pg_dump`
over the direct connection. Run it before anything risky, and occasionally
otherwise. Keep a copy somewhere that is not your laptop.

The dump is scoped to `--schema=public --schema=drizzle`. Without that, pg_dump
also captures Supabase's own `auth`, `storage` and `realtime` schemas — 34
tables this app never touches, which the platform owns and recreates itself,
and which cannot be restored into a fresh project or into plain Postgres. That
made the file forty times larger and not restorable, which defeats the point.

Verified end to end: the dump restores into a clean Postgres 17 with zero
errors, reproducing all 4 tables, 4 enums and 11 indexes.

If it fails with a server version mismatch, your local `pg_dump` is older than
the database — `pg_dump`'s major version must be **>=** the server's. Check the
server version under **Project Settings → Infrastructure** and install a
matching client:

```bash
brew install postgresql@17
brew unlink postgresql@15          # if an older one is linked
brew link --overwrite --force postgresql@17
```

Note that this repoints `psql` and `pg_dump` system-wide. `brew unlink
postgresql@17 && brew link postgresql@15` puts it back.

---

## Commands

| Command            | What it does                         |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | Development server                   |
| `pnpm build`       | Production build                     |
| `pnpm lint`        | ESLint                               |
| `pnpm typecheck`   | `tsc --noEmit`                       |
| `pnpm test`        | Vitest — the domain logic            |
| `pnpm format`      | Prettier                             |
| `pnpm db:generate` | Generate a migration from the schema |
| `pnpm db:migrate`  | Apply migrations (direct connection) |
| `pnpm db:export`   | `pg_dump` to `./backups/`            |

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

These are implemented precisely and unit-tested (59 tests, `pnpm test`).

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
