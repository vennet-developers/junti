# Decisions

Every judgement call made while building this, and why. Written as they were
made. Where the spec was explicit I followed it; this file covers the gaps it
left, the places I chose between defensible options, and the two places I think
the result is worth questioning later.

---

## Product and scope

### 1. `waived` participants still count in the split denominator

The spec defines `waived` as a payment status and defines the split as "evenly
across participants with `attendance = 'in'`". Attendance and payment status are
separate axes, so waiving somebody's share does not remove them from the
denominator — the cost doesn't vanish, the organizer absorbs it.

The alternative (re-splitting the waived amount across everyone else) would mean
one person's favour silently raises everybody else's bill, which is exactly the
kind of quiet reconciliation the spec forbids elsewhere. Waived money is
reported as its own line so the organizer can see what they absorbed.

### 2. A confirmed payment from someone who later drops out still counts as collected

They paid; the organizer is holding that money. Removing it from the collected
total would make cash disappear from the ledger. Their share drops to zero
(they're no longer attending), which produces a discrepancy warning — which is
the correct outcome, because a refund is now owed and that is a real-world
conversation, not a database update.

### 3. The organizer adding somebody is still subject to capacity

The spec doesn't say either way. If the organizer could bypass the cap, the
waitlist would mean nothing and the roster could quietly exceed a field's
capacity. Manually added people go to the waitlist when the event is full, same
as everyone else. The organizer can then promote them explicitly — which is one
extra tap and makes the override deliberate rather than invisible.

### 4. Identity is the display name, with a device cookie as the amendment key

There are no accounts, so "who are you" has to be answered by something. The
name is the identity (case-insensitively unique per event, enforced by a
database index), and the `edit_token` cookie proves _this device_ owns _that
row_.

The consequence, accepted deliberately: submitting an existing name **without**
the matching cookie is rejected as a duplicate rather than silently taking over
that entry. Someone switching phones has to ask the organizer to fix it. That is
the safe failure — the alternative lets anyone with the public link overwrite
anyone else's RSVP by typing their name.

### 5. The cookie is scoped per event and `httpOnly`

Keyed by event id (`rsvp_<uuid>`), so one phone can hold RSVPs for several
events without them clobbering each other, and path-scoped to `/e/<token>`.
`httpOnly` because nothing client-side needs to read it.

### 6. The participant page shows collected + outstanding, which can exceed the event total

Once a confirmed payment is preserved through a re-split, `collected +
outstanding` no longer equals the event cost. The progress bar reads e.g.
"$125.001 de $300.001" against a $250.000 event.

This is arithmetically honest — it is the actual state of the ledger — and the
spec is explicit that the confirmed amount must stand and the difference must be
surfaced rather than reconciled. The organizer sees a per-person warning naming
the exact amounts. **This is the decision in this file I would most want a real
user to react to**: it is correct but it looks odd, and the right long-term
answer may be to show the drift on the participant view too rather than only the
raw totals.

### 7. Cost amounts accept `50.000`, `50 000` and `50000`

A Colombian typing a price uses `.` as the thousands separator. Rejecting that
would be pedantic, and for a whole-peso currency the intent is never ambiguous.
Separators are stripped before parsing.

### 8. Currency is fixed to COP in the UI

The schema supports any ISO-4217 code and the formatter handles minor-unit
exponents properly (COP/CLP/JPY = 0 decimals, most others = 2). But exposing a
currency picker is a feature nobody in the target group needs, and section 7
says don't build what isn't in section 6. It is a `defaultValues` entry on the
form controller with no control rendered; adding one is a one-line edit.

---

## Stack and architecture

### 9. No Tailwind

The scaffold was generated with `--no-tailwind`. Stackmyth ships its own CSS and
design tokens, and the spec requires respecting them exclusively. Adding
Tailwind would introduce a second, conflicting spacing and color scale and make
"no hardcoded values" much harder to hold.

The escape hatch in the spec mentions plain Tailwind for a blocked component. No
component was blocked to that degree; where I had to compose around a Stackmyth
limitation I used Stackmyth primitives and marked it `// STACKMYTH-GAP:`. The
only hand-written CSS is `src/app/globals.css`, ~50 lines of base styles, every
value a `--sm-*` token.

### 10. No Stackmyth theme file

`@stackmyth/core/core.vars.css` already defines a complete neutral palette
_and_ a `prefers-color-scheme: dark` block. The named themes (`corporate`,
`graphite`, …) each `@import` a Google Fonts URL, which would add a third-party
request on every page load for users on Colombian mobile data.

So: no theme, plus the self-hosted `@stackmyth/core/fonts/geist.css`. The app
makes **zero third-party requests**, and dark mode works with no code.

### 11. Body text is the largest step on the type scale

Stackmyth's default (`--sm-font-size-md`) is 14px, tuned for dense desktop UI.
This app is read one-handed on a phone, so the body baseline is
`--sm-font-size-xl` (16px) — still a token, still on the scale, just the other
end of it.

### 12. Server actions only — no REST layer

Per the spec: there is no second consumer. Every mutation is a server action;
every read happens in a server component.

### 13. `src/domain/` duplicates the enum types instead of importing them

`src/domain` must have no framework or ORM imports, and importing the enum types
from `src/db/schema.ts` would pull Drizzle in. The unions are declared in
`src/domain/types.ts` and mapped in `src/lib/roster.ts`, where TypeScript checks
the two agree. Three string unions duplicated is a cheap price for a testable,
dependency-free core.

### 14. Ties in join order are broken by id

Both the split remainder and the waitlist order sort by `created_at`. Two rows
can share a timestamp, and without a tiebreak the same input could produce two
different splits — the extra peso would appear to move between people between
page loads. Sorting by `(joinedAt, id)` makes it deterministic.

### 15. UUIDv7 primary keys

Time-ordered, so they cluster well in the index and sort naturally by creation —
which is what both the waitlist and the remainder distribution need. Generated
in application code via the `uuidv7` package rather than in the database, so the
schema stays portable to any Postgres provider.

### 16. Non-async exports removed from `"use server"` modules

A module with the `"use server"` directive may only export async functions —
every export becomes a callable server action. Initial `useActionState` values
are declared in the client components instead, and the RSVP cookie name lives in
`src/lib/rsvp-cookie.ts`. Found the hard way: a `const` exported from an action
module builds fine and arrives as `undefined` at runtime.

### 17. `/stackmyth-smoke` is kept, not deleted

Build order step 2 called for a throwaway page. I kept it: it is the cheapest
possible regression check that the UI layer still integrates after a Stackmyth
version bump, and it is exactly what caught the missing-stylesheet problem
below. It is `noindex` and linked from nowhere. Deleting the directory removes
it cleanly.

---

## Infrastructure

### 18. In-memory rate limiting

The zero-cost constraint rules out Redis or any hosted counter. `rateLimit()` is
a `Map` in the process's memory, so on Vercel each warm serverless instance
keeps its own — the effective limit is the configured value times the number of
instances.

This is honest about what it defends against: someone bored hammering the create
form or an RSVP box from a phone. It is not a defence against a distributed
attack. Documented as such in the README and in the module's own comment, rather
than implied to be more than it is.

### 19. Absolute URLs come from request headers, not an env var

Share links are built from `x-forwarded-host` / `host`, so they are correct on
localhost, on every Vercel preview deployment, and in production with no
environment variable to keep in sync and no chance of a preview build emitting
production links.

### 20. Keep-alive writes rather than reads

`select 1` would satisfy the letter of "activity", but some managed providers
count only write traffic. A single-row upsert into a `heartbeat` table is barely
more expensive and unambiguous.

### 21. The dev container is pinned to Postgres 15

Not for any application reason — to match the `pg_dump` available locally, since
`pg_dump` refuses to run against a newer server. `npm run db:export` was verified
end-to-end (9.4 KB dump) rather than assumed. The script now prints the fix when
it hits that mismatch.

### 22. Migrations are checked in and never run from the dashboard

Per the spec. The generated SQL is plain Postgres with no Supabase-specific
extensions, so the schema moves to Neon, RDS, or a local container unchanged —
which is the point of not coupling to the provider.

### 23. pnpm, with exactly one lockfile

The project was scaffolded with npm and later installed with pnpm, which left
`package-lock.json` and `pnpm-lock.yaml` side by side. That is not a cosmetic
problem: **Turbopack infers the workspace root by walking up the tree looking
for a lockfile, and two reachable lockfiles make the inference ambiguous.** The
dev server died with

```
Next.js inferred your workspace root, but it may not be correct.
We couldn't find the Next.js package (next/package.json) from the project
directory: …/src/app
```

which reads like a broken import and is actually a package-manager problem.

Resolved by committing to pnpm: `package-lock.json` deleted, `packageManager`
pinned in `package.json`, and `turbopack.root` set explicitly in
`next.config.ts` so the root is never inferred again — that last part also
makes the project immune to a sibling monorepo's lockfile, which matters here
because Stackmyth's own repo sits next door.

Switching back to npm is a two-line revert; the point is that exactly one
lockfile may exist at a time.

### 24. Dependency build scripts are approved individually, not in bulk

pnpm blocks `postinstall` scripts by default and reports
`ERR_PNPM_IGNORED_BUILDS`. The obvious fix, `pnpm approve-builds`, approves
whatever happens to be in the tree — which defeats the point of the block.

`pnpm-workspace.yaml` records a decision per package instead:

- **`esbuild` — allowed.** drizzle-kit and vitest both invoke it; its install
  step places the platform binary.
- **`unrs-resolver` — allowed.** Native module behind the ESLint import
  resolver that `eslint-config-next` pulls in.
- **`sharp` — refused.** It exists only to serve Next.js Image Optimization,
  which this project explicitly does not use (COSTS.md). Compiling a large
  native dependency for a switched-off feature is pure cost.

If that warning reappears, a dependency has added a new build script and it
deserves the same one-line judgement rather than a blanket approval.

### 25. The registry token is not in the committed `.npmrc`

The project `.npmrc` originally carried
`//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`. npm expands that;
**pnpm deliberately does not**, because the file is committed and a leaked
token would be sent to whatever registry the file names. pnpm warns and ignores
the line.

That asymmetry is the worst possible outcome — it works under one installer and
silently fails under the other. The committed file now carries only the
scope→registry mapping (safe, and required on a fresh clone), and the
credential goes to `~/.npmrc`, `pnpm config set`, or Vercel's `NPM_RC`
environment variable. Documented in the README rather than left to be
rediscovered.

### 26. Client validation with `@stackmyth/form`, server action still the authority

I originally dismissed `@stackmyth/form` as incompatible with server actions.
That was wrong, and worth recording as a misjudgement rather than quietly
fixing: `FormController` is a _validation and state_ layer, not a submission
layer. `handleSubmit(onValid)` hands you the validated values and you decide
what to do with them — including calling a server action.

The split now:

- **Browser** — `FormController` + `createZodResolver(eventClientSchema)`
  validates on blur and shows per-field messages with no round trip.
- **Server** — the action re-parses everything with `eventSchema` before
  touching the database. A client that skips, spoofs or disables validation
  changes nothing.

Both schemas are built from the same field definitions in `validation.ts`, so a
rule cannot be tightened in one and forgotten in the other. The client one adds
no transforms; the server one does the parsing.

**What this cost.** Progressive enhancement — the forms no longer submit
without JavaScript. That is not a real loss here: `Select`, `Calendar` and
`TimePicker` are popover-based and cannot be operated without JS at all, so
these forms were never usable in a no-JS browser.

**What this bought.** Instant feedback, and the deletion of every hidden input
in the app (see #27).

### 27. Zero hidden inputs, because submission stopped going through `FormData`

An earlier pass had seven `<input type="hidden">`: mirrors for `Select` (which
has no `name`), for the date and time, for the currency, and for the
participant id and target status on each organizer row button.

All gone. Values now reach `FormController`'s store via `store.setValue()`, and
the organizer's row buttons call their server actions with **bound arguments**
instead of submitting a form — there is nothing to type in those controls, so a
form plus hidden fields was only a way to smuggle values the caller already
knew. Those actions take plain parameters now and still validate them
server-side, because a bound argument is client-supplied data like any other.

### 28. The date field is composed from `Popover` + `Calendar`, not `DatePicker`

`DatePicker` looks like the right component and is not, for two independent
reasons — both verified, both logged (STACKMYTH-GAPS.md #11 and #12):

1. Its `locale` prop only formats the trigger label. The `Calendar` inside is
   hardcoded to `"en-US"`, so a Spanish app gets an English calendar with no
   way to reach it.
2. Its hidden value is `value.toISOString()`. For a date-only field that is
   lossy: the calendar builds local midnight, so a user east of Bogota would
   submit the previous calendar day and the event would silently move.

So the field is `Popover` + `Calendar` + `Button`, which is the documented
escape hatch and gives access to `locale`, `weekStartsOn={1}` (Colombia starts
on Monday), `timezone` and `fromDate`. It submits `YYYY-MM-DD` built from local
getters, and `TimePicker` contributes `HH:mm` — two wall-clock strings that the
server joins and resolves against Bogota's real offset, reusing the timezone
logic that was already there.

### 29. `capacity` validates as `string | number`

The same schema runs on both sides of the wire and the two sides disagree about
the type. `FormData` always yields strings; `@stackmyth/form`'s store reads an
`<input type="number">` as an actual `number`. A `z.string()` passes on the
server and fails in the browser with _"expected string, received number"_ — a
baffling message for a field the user filled in correctly. Accepting both and
normalising is the honest fix.

---

## Mobile

The brief said mobile-first and I had been designing at 390px — or so I
thought. The audit below found otherwise, and found real bugs.

### 30. My earlier "verified at 390px" was actually 500px

Chrome's window has a ~500px floor and the devtools viewport override kept
failing to apply, so every screenshot I called a 390px check was really 500px.
Not a huge gap in absolute terms, but it hid the worst bug in this file (#31).

Since no CSS in this app or in Stackmyth distinguishes 390 from 500 —
Stackmyth's breakpoints start at 640px and nothing uses `vw` — clamping
`html`/`body` to 390px reproduces the real layout faithfully. That is how the
current numbers were measured.

### 31. The organizer's roster rows collapsed to one character per line

At 390px the row was `ListItemContent` + `ListItemAction` side by side with
`flex-wrap: nowrap`. The controls needed ~347px of a 358px row, which squeezed
the name column to **literally zero width** — and because the page shell
carried `wordBreak="break-word"`, a zero-width column renders one letter per
line. Names came out as vertical ticker tape.

Two fixes, both needed:

- The row is now a vertical `Stack`: identity on one line, controls on the
  next, each full width, with `minWidth="0"` on the name so it wraps normally
  instead of forcing the row wider than the screen.
- `wordBreak="break-word"` is gone from the page shells. It was there for long
  URLs, which is a job for the one component that actually shows a URL —
  `LinkPanel` already scopes `wordBreak="break-all"` to itself.

### 32. Tap targets come from `--sm-density-factor`, not hardcoded heights

33 of 37 buttons were under the 44px guideline; the roster row controls were
**26px**. Rather than pin heights, the app raises Stackmyth's own density knob
to `1.4` in `globals.css` — every control's padding is
`calc(<base> * var(--sm-density-factor))`, so one token widens every target in
the app. Smallest control is now 41px, from 26px, with no magic numbers.

### 33. The organizer panel collapses what you don't need every visit

It was 5,273px — **6.2 phone screens** — because the share links and the entire
edit form were always expanded. Both are occasional; the roster and the money
are why you opened the page.

Now: event details, then a collapsed **Links** section (expanded only on
`?created=1`, when the links genuinely _are_ the task), money, roster, then
collapsed **Agregar** and **Editar**, and finally **Cerrar evento** — last and
low-key, because it ends the event's life. **2.5 screens**, down 60%.

### 34. The RSVP box moved above the roster

Everyone arrives from a WhatsApp link with one thing to do. The roster came
first, so answering meant scrolling past four groups of names — a screen and a
half before you could act. Who else is coming is interesting; answering is the
point. The form now sits right under the event details.

### 35. A full event says so _inside_ the form, before you submit

The page showed "Cupo lleno" near the top and the RSVP box said nothing; you
only learned you were on the waitlist _after_ submitting. That is the kind of
surprise that makes people distrust a form. The warning now lives in the form,
naming the consequence ("si eliges «Voy», quedas en lista de espera"), and the
separate top-of-page notice is gone so it is not said twice on one screen.

### 36. Smaller headings and money figures

Stackmyth's `h1` is sized for a desktop hero: "Fútbol de los jueves" wrapped to
two lines and ate a third of the first screen. The title is now `as="h1"`
(correct outline) with `variant="h2"` (mobile size). `Stat` renders its value at
32px — the same size as the page title — so two of them side by side shouted
louder than the event name; they take a `Text` node at `h4` instead.

---

## Organizer accounts (reversal of a founding constraint)

### 37. Accounts were added on purpose, against the original spec

The brief was explicit: section 2 said "No user accounts. No login. No
passwords."; section 3.2 banned `@supabase/supabase-js`, `@supabase/ssr` and
Supabase Auth; section 7 listed accounts and OAuth as out of scope. This
reverses all three, on the owner's instruction, to get organizers a history of
their events and a profile photo.

Recorded as a deliberate change of direction, not an oversight. The
`@supabase/*` packages are now present for a reason they were never banned
for — the ban was about using them as a _data_ client.

### 38. Supabase Auth for identity, Drizzle for data

The packages are used **only** to establish who is signed in. Every event,
participant and payment still moves through Drizzle over Postgres from server
code.

What that preserves:

- The domain logic and its 59 tests, untouched.
- Migrations in the repo, still plain Postgres, still portable.
- **No RLS.** There is still no browser-side database access, so there is still
  nothing for RLS to protect. Adding it now would be the security theatre the
  original decision avoided.

The publishable key does ship in the browser bundle — that is what
`NEXT_PUBLIC_` means — but it grants no data access here, because the only
thing it talks to is the auth endpoint.

### 39. Participants still have no accounts

Only organizers sign in. Asking someone who received a WhatsApp link to
authenticate before answering "¿vienes?" would break the one thing this app is
for. The RSVP flow is unchanged.

### 40. An event is managed by the token OR by its owner

Two independent routes, both server-checked:

1. **The organizer token in the URL** — the original model, and still the only
   one that works for someone without an account. It is how you hand an event
   to a friend.
2. **Ownership** — the signed-in account that created it, which is what lets
   the history page link straight into managing.

Ownership is read from the verified session (`getUser()`, which revalidates
against Supabase — not `getSession()`, which trusts the cookie). Events created
while signed out have a null `organizer_id` and remain token-only.

### 41. `organizer_id` has no foreign key to `auth.users`

A cross-schema FK would tie these migrations to Supabase specifically, and
portability was an explicit requirement (#22). The column is a plain uuid
meaning "the identity that owns this event". Swapping the identity provider
would not need a migration.

Nothing about the person is stored — no profile table, no copied name or
avatar. The session already carries them, and the history only ever shows the
viewer their own events, so there is no case needing another user's details.
One less thing to keep in sync, one less place holding personal data.

### 42. The session proxy has a narrow matcher

`src/proxy.ts` (Next 16 renamed `middleware` to `proxy`; it is Node-only) exists
because Server Components cannot set cookies, so an expiring session would sign
someone out mid-visit. But every matched request is a billable invocation, and
COSTS.md commits to the free tier — so it matches only `/my-events`, `/sign-in`,
`/auth/*` and `/new`. The participant page, the one a whole WhatsApp group opens
at once, is deliberately excluded.

---

## Policies, languages and time zones

### 43. Policies gate confirmation, not attendance or money

An event can attach requirements — proof of payment, an acknowledgement — and
somebody who has not met them shows as pending rather than confirmed. What that
deliberately does **not** touch is capacity or the split: an unconfirmed person
still holds their spot and still owes their share.

The alternative — freeing the spot until they pay — sounds tidier and is worse.
A slow payment would silently reopen a spot somebody already believes they have,
the waitlist would promote over them, and the roster would overbook itself every
week without anyone doing anything wrong. Confirmation is about how certain the
organizer is, and that is a display question. `partitionByCompliance` is the
only thing policies change, and `split.ts` and `waitlist.ts` never learned they
exist — which is why their 59 tests still hold unchanged.

### 44. Proof of payment is approved by a human; an acknowledgement approves itself

Ticking "I read the instructions" is its own proof, so it is settled the moment
it is submitted. A receipt is a claim about the world, so it waits for the
organizer. If uploading any image confirmed you, the policy would be checking
that a person owns a camera.

### 45. Receipts live in Postgres, not object storage

Supabase Storage is free, purpose-built for this and the obvious choice. It
lost on one point that outweighed the rest: **the free tier keeps zero
backups**, so `pnpm db:export` is the only copy of anything that exists. Bytes
in a table are inside that dump. Bytes in a bucket are not, and would be gone
exactly when it mattered.

Two smaller reasons pointed the same way. Storage needs either RLS — banned by
the spec — or server-signed URLs, and it would drag `@supabase/supabase-js`
back in after it was deliberately removed. A `bytea` column also keeps the
"portable to any Postgres" property that the migrations are built around.

The cost is real: images are the only thing here that consumes the 500 MB
allowance at any rate. It is bounded by shrinking every upload in the browser to
100–200 KB before it is sent, which puts the comfortable ceiling around 1,500
receipts — years, for a group of friends. COSTS.md records where the line is,
and `src/lib/evidence-store.ts` is the single module that has to change to cross
it.

### 46. The receipt is organizer-only, enforced by there being one way to read it

A payment screenshot carries a full name, a phone number and a bank. The
participant page is opened by an entire WhatsApp group, so the image is served
by exactly one route, under the organizer token, and no page anywhere selects
its bytes. The image lives in its own table so that a careless
`select().from(policySubmissions)` cannot pull it into a page by accident.

That route checks two things, not one: that the caller is the organizer of the
event named in the path, **and** that the submission belongs to that event.
Without the second check, any organizer could read any submission in the
database by guessing an id.

### 47. The timezone belongs to the event; the language belongs to the reader

They answer different questions, so they resolve differently. A match at 8 p.m.
in Medellín is at 8 p.m. for everyone reading the roster, including the person
reading it from Madrid — rendering in the reader's zone would tell them 3 a.m.
and be technically correct and useless. Month names and separators, on the other
hand, should follow whoever is looking.

So `events.time_zone` is stored and every timestamp renders through it, while
the language comes from the reader's cookie, then their `Accept-Language`, then
the event's own — the event's choice being a sensible default for a group chat,
never an override of somebody's explicit pick.

**What is never translated is anything a person typed.** Titles, notes, names
and policy labels are stored and shown exactly as written. A friend's "Llevar
guayos" stays that way on an English page, because the alternative is machine
translation of a message from someone the reader knows.

### 48. Two language files, checked by the compiler, no i18n library

`copy/es.ts` is the shape and `Copy` is inferred from it; `copy/en.ts` is typed
as `Copy`. A missing key, a renamed one or a function taking the wrong arguments
is a build error rather than `undefined` rendered to somebody. No extraction
step, no message catalogue, no runtime dependency — the whole mechanism is one
object per language.

Two consequences worth naming:

- **The provider takes a locale string, not the resolved strings.** `Copy` holds
  functions like `spotsLeft(n)`, and functions do not cross the
  server-to-client boundary. Passing the object would fail to serialize.
- **Every Zod schema became a factory taking `Copy`.** A schema built once at
  import time bakes in whichever language compiled first, and hands a Spanish
  validation error to someone reading the English page.

### 49. Reading the language cookie makes the whole app dynamic

The root layout reads it, which opts every route into dynamic rendering —
including the home page, which could otherwise be served from the CDN. That is
the price of honouring the choice everywhere: a page cached in one language
would eventually be served to a reader who picked the other.

Every page that matters already hits the database, so this costs one static
route. The session-refresh proxy pays for its own extension to the event page
differently: it returns immediately unless a Supabase cookie is present, so the
WhatsApp group opening a roster pays for a map lookup, not a round trip.

---

## The catalogue: open data, closed behaviour

### 50. Event types and policies are tables, not enums

`event_kind` and `policy_kind` were Postgres enums, and the per-kind
suggestions were a constant in TypeScript. Adding "tournament" cost a
migration, a code change and a deploy — three things, for what is a fact about
the product rather than about the software.

They are now `event_types` and `policy_definitions`, joined by
`event_type_policies`. Adding a kind of event is a row. Adding a policy that
behaves like an existing one is a row. Changing which policies a kind suggests
is a row. Renaming or translating any of it is an UPDATE.

Verified rather than asserted: a `tournament` type and a
`registration_receipt` policy were inserted with SQL against a running server,
appeared in the create form in both languages with the right suggestions, and
an event was created against them — no restart, no rebuild, no deploy.

### 51. `handler` names a behaviour; it does not describe one

This is the load-bearing decision, and it is where the extensibility stops
being free.

Data can be open. Behaviour cannot: a row cannot ship a file input, a canvas
resizer, a byte sniffer and a review screen. So `policy_definitions.handler`
holds a string, and `src/domain/policy-handlers.ts` maps it to an
implementation.

Three things have to agree for a policy to work — the control the participant
sees, what the server accepts, and who settles it — which is precisely why the
behaviour is NOT defined in the component. If the component were the source of
truth, the server would have to trust the client about what to validate, and
for a payment gate it cannot. The key in the database is the contract; the
component is one of three things registered against it.

`handler` is deliberately separate from `slug`, so "Comprobante de pago" and
"Comprobante de inscripción" can be two catalogue rows a participant reads
differently and one implementation. That separation is the whole difference
between adding a policy and adding a _kind_ of policy.

Renaming a handler key is a data migration, not a refactor: the old string is
in rows that are already live. A test asserts the seeded keys still exist.

### 52. An unknown handler is inert, not blocking

A catalogue row can name a behaviour this build does not have — a database
seeded ahead of the code, or a deploy rolled back under it.

Such a policy is excluded from `blocking` and reported in `unsupported`, so
nobody is held back by a requirement they cannot act on, and the organizer sees
a warning explaining why. Fail-safe rather than fail-closed, because this is
roster tidiness and not security: blocking would strand every participant with
no way forward, to punish an operator error.

### 53. Retire catalogue rows, never delete them

Both foreign keys into the catalogue are `restrict`, and `is_active = false` is
how something leaves the picker. `cascade` would mean a tidy-up in the
catalogue could delete somebody's event, and reads of existing events
deliberately ignore `is_active` — retiring a policy must not blank out the
requirement on events that already carry it.

Tested: with one event live, deleting its event type and its policy definition
both raise `foreign_key_violation` and everything survives.

### 54. An event's label is an override, and NULL is the interesting value

`event_policies.label` is nullable, and null means "follow the catalogue". That
is what makes the catalogue a source of truth rather than a template that was
copied once: fixing a typo in a definition fixes it on every event that never
overrode it, in every language.

It shows up in the interface as a field that is **empty, with the catalogue
text as its placeholder**. The consequence for the edit form is subtle enough
to have its own field on the domain type: it must be sent the raw
`labelOverride`, not the resolved `label`, or the first save would silently pin
every inherited policy to its current wording.

### 55. Translations are `jsonb`, not a translations table

Catalogue labels are `{"es": "...", "en": "..."}` in a column. A translations
table would buy referential integrity on the locale key and cost a join on
every read plus a second table to seed and administer. With a closed set of
locales declared in code and a fallback chain, that integrity is not worth the
weight — and the property that mattered, adding a language without a migration,
is present either way.

Nothing indexes the object directly. `pickLabel()` falls back through the
requested locale, the default locale, any populated one, and finally the slug —
a raw `kids_party` on screen is unmistakably a missing translation, where an
empty string is a blank nobody notices.

### 56. There is no administration screen yet

The catalogue is administered with SQL or the Supabase table editor. That is a
real limitation and it is deliberate for now: the tables and their constraints
are the part that is expensive to change later, and a CRUD screen over four
small tables is not.

---

## The timezone default, and how local development hid it

### 57. Detecting the organizer's timezone is a browser job, and it was not

`detectTimeZone()` was called from `src/app/new/page.tsx` — a **server**
component. `Intl.DateTimeFormat().resolvedOptions().timeZone` there resolves
the _server's_ zone, which is UTC on Vercel. Every event created in production
defaulted to UTC while the picker looked perfectly reasonable, so an organizer
who did not think to check it scheduled an 8 p.m. match that read as 3 p.m. in
Bogotá.

**It passed every test I ran because this machine is in America/Bogota**, which
is also the fallback. Local and production agreed by coincidence, on a value
that was right for the wrong reason. Confirmed by asking the deployed app
rather than reasoning about it: production offered "Hora de UTC (GMT+0)".

The fix has three parts, and the middle one is the part that would have been
easy to miss:

1. The server renders a fixed floor, `DEFAULT_TIME_ZONE`, and no longer
   pretends to detect anything.
2. The form resolves the real zone with `useSyncExternalStore` — server
   snapshot returns the floor, client snapshot returns the device's zone. That
   is precisely what the hook is for, and it avoids both a hydration mismatch
   and a `setState` in an effect.
3. **`SelectField` follows a changed `defaultValue` into the form store.**
   Without this the control would display the detected zone while the store
   still held the floor, and the form would submit Bogotá while the screen said
   Madrid — a worse bug than the one being fixed, and invisible until you read
   the row afterwards.

Verified by making the server floor `Asia/Tokyo` and loading the page from a
browser in Bogotá: the HTML said Tokyo, the rendered control said Bogotá, and
the created row stored `America/Bogota` with `starts_at` at the correct +5
offset.

The lasting protection is a comment on `detectTimeZone` saying it is
browser-only and why, because nothing about the call site made it obvious and
the type system cannot tell a server component from a client one.

---

## Reader preferences

### 58. The reader's language now beats the event's

Decision #47 put the event's language ahead of the browser's, reasoning that
the organizer picked it for a page a whole group chat reads. Reversed on the
owner's instruction, and the new rule is easier to state: **the interface is in
the reader's language, full stop.**

The event's language survives only as a fallback for a browser asking for
something we do not speak — better than defaulting a French reader to Spanish
when the event was created in English.

Order: preference cookie → `Accept-Language` → the event → Spanish. Verified
across all five cases, including the two where the cookie has to win.

### 59. Reader-side timezone conversion, with the zone always named

Decision #47 also said the timezone belongs to the event, not the reader, and
that rendering in each reader's zone would tell the traveller 3 a.m. and be
useless. That is now reversed too, on the Calendly model — and the reason it is
safe is the part Calendly gets right and my objection assumed away: **Calendly
never shows a converted time without its zone.**

So the rule is two-sided and both halves are load-bearing:

1. Times render in the reader's zone, so somebody abroad can act without doing
   arithmetic.
2. The place is always named, and when the reader's zone differs from the
   event's, **both times are shown**. `describeEventTime` returns a `secondary`
   line that is null in the common case, so a group of friends in one city sees
   exactly one line, as before.

### 60. Storage is UTC and always was; `time_zone` is intent, not a time

The owner asked that everything be stored in UTC. It already is — every column
is `timestamptz` and `starts_at` is an instant.

Worth writing down because the two are easy to conflate: `events.time_zone` does
NOT store a time. It stores which wall clock the organizer meant, which a UTC
instant alone cannot recover — 01:00Z is 8 p.m. in Bogotá and 9 p.m. in Santiago,
and only the stored zone says which one somebody typed. It is what makes "8 p.m.
in Medellín" showable next to a converted time.

### 61. Cookie for the effective value, table for the durable one

Both, and each earns its place:

- The **cookie** is what the server reads. It has to know the language and zone
  to render the first paint, and reading a preferences table on every request —
  on a page a whole WhatsApp group opens at once — would be a database round
  trip for nothing.
- The **table** is what makes a setting follow somebody to a new phone. It is
  read exactly once, in the auth callback, to seed the cookie.

`localStorage` was the owner's first instinct and was rejected in conversation
for a concrete reason: it does not exist on the server, so the language would
be server-rendered from the browser header and then corrected — a visible flash
of the wrong language on every page load.

### 62. NULL means "follow my browser" — no second boolean

`user_preferences.locale` and `.time_zone` are nullable, and that IS the
override switch. Setting a value turns it on; choosing the automatic option
writes NULL and turns it off.

The alternative — a value plus an `override_enabled` flag — is two pieces of
state that can contradict each other, and every reader of them has to decide
which wins. In the interface this shows up as one dropdown whose first option
is "the one my browser uses", not a checkbox that greys out a control beside it.

Saving NULL also clears the cookie rather than leaving it, so "follow my
browser" travels between devices too. Otherwise turning the override off on one
phone would be silently undone by the next sign-in.

### 63. The browser tells the server its timezone once, via a cookie

The server cannot detect a zone. `TimeZoneSync` writes the detected one into
the same cookie the profile uses, then refreshes once.

The cost is honest and bounded: a first-time visitor renders once in the
event's zone and once more in their own. The alternatives were worse — either
re-format every date on the client after paint, which flashes on every load, or
show everyone the event's zone regardless, which is the behaviour being
replaced.

---

## A rule I broke

### 64. Routes are code, so they are in English

The brief says code, identifiers, comments and docs are English, and only what a
human reads is Spanish. Routes are code. Three of them were not: `/entrar`,
`/mis-eventos` and `/perfil`, added while building organizer accounts and the
profile page, and each one looked reasonable next to the Spanish page it served.

Renamed to `/sign-in`, `/my-events` and `/profile`, with no redirects from the
old paths — the app has one account and no shared links pointing at them, so a
clean break beats permanent compatibility cruft.

The lasting fix is `src/config/routes.ts`. Every static path is a named constant
there, which is what makes the rule checkable at a glance instead of depending
on nobody typing a Spanish word into a string literal. A path that exists in one
module cannot drift from a redirect in another, either — that failure is silent,
because a stale redirect just lands somebody on a 404.

What did NOT move: `/e/<token>` and `/e/<token>/manage/<token>` were already
English and are the links people actually hold, so no shared URL changed.

---

## Two ways to create an event

### 65. Attribution is decided at creation and cannot be fixed later

An event created signed out has `organizer_id = null` forever. There is no
claiming it afterwards, which makes the moment of creation the only one where
the decision is visible — and `/new` used to say nothing at all about it. A
session that had quietly expired produced an orphaned event, and the only
symptom was its absence from My events days later.

Hence the pill at the top of the form: signed in it names the account, signed
out it offers Google or email and explains what is lost. Creating without one
stays one tap away. The anonymous flow is the original product, not a
punishment.

### 66. Only editing needs an account — payments never do

Signed out you keep the organizer link and everything it does: mark payments,
add people, promote from the waitlist, close the event. What you cannot do is
change the event's details.

The alternative considered and rejected was withholding the organizer link
entirely from anonymous creators. It would push harder toward accounts and it
would gut the product: "who has already paid" is half of what this app is for,
and an organizer who cannot record a payment has a roster, not a ledger.

Enforced in `editEvent`, not merely hidden. The panel is reachable by anyone
holding the link, so the missing form is a courtesy and the action is the rule.
The panel says _why_ rather than showing nothing — an absent form reads as a
bug, where "this event was created without an account" is a fact about how it
came to exist.

### 67. Where you land after creating depends on whether it is recoverable

**Signed out** → the organizer panel with the links open, because those two URLs
are the only way back into the event that will ever exist.

**Signed in** → My events, where it is the first card. It is recoverable
forever, so the links stop being an emergency. That is also why the cards grew a
share button: account holders now arrive there immediately after creating, and
sharing is what they came to do.

### 68. Two duplicate buttons, because they answer different questions

- **Duplicate** creates it immediately, same time next week. For the fixture
  that never changes — five-a-side every Thursday — where a form to confirm what
  you already know _is_ the friction.
- **Duplicate and edit** opens the form already describing next week, for the
  week the pitch moved or the price went up.

Offering only the first risks events nobody checked; only the second leaves the
weekly case two screens away. They are cheap to have both.

Next week is seven days added to the **UTC instant**, not to the local date.
Because the stored zone is applied at render time, that is what preserves the
wall clock — including across a daylight-saving change, where adding a local
date would move the hour.

A duplicate gets **new tokens**: it is a different event, and reusing the links
would put two rosters behind one URL. It carries the requirements but not the
submissions against them — a new week is a new round of proving you paid.

Guarded against the double tap: same owner, same title, same instant is refused
with a message rather than silently creating twins, because on a phone one
gesture can easily be two events.

### 69. A parked draft, so signing in does not cost you what you typed

The pill offers Google, which is a navigation to another origin and back. Left
alone, the feature meant to help you attribute an event would throw away the
event you were describing.

The form is written to `sessionStorage` before leaving and restored on return —
`sessionStorage`, not `localStorage`, because a draft is worth one tab and one
sitting; finding a stale half-event weeks later would be worse than losing it.

Restoring costs one remount right after hydration: `FormController` builds its
store once and several controls hold their own state, so keying the body on
whether a draft was found is what makes them all take the restored values. It
happens before anybody has typed, so nothing is visibly disturbed.

`?from=<id>` for "duplicate and edit" outranks a parked draft — arriving there
is an explicit request for _that_ event.

---

## A second rule I broke

### 70. The Stackmyth inventory was taken from what was installed, not what exists

`STACKMYTH-NOTES.md` opened with "if a component is not in this file, it does
not exist for this project" — written after reading every `.d.ts` under
`node_modules/@stackmyth`. That enumerates the **installed** packages, and the
initial `package.json` was a guess. Ten published packages were therefore
invisible for the entire build.

Two had already been worked around in code:

- the amount field used `<Input prefix="$">` where `InputGroup` exists;
- the receipt upload used a bare `<input type="file">` under a comment
  asserting _"the library has no file field"_ — which was simply false.

A gap log that records absences which are not real is worse than no gap log. The
notes now carry the correction, and the discovery method is `pnpm view
@stackmyth/<name> version` against the registry rather than a directory listing.
`combobox`, `tabs`, `tooltip`, `toast`, `slider`, `pagination`, `breadcrumb`,
`table` and `data-table` are also published and available if wanted.

Recorded as STACKMYTH-GAPS.md #16, because the library makes it possible: there
is no meta-package, `@stackmyth/manifests` is empty, and an npm scope cannot be
listed.

### 71. Nothing turns red until the create button is pressed once

`mode="onBlur"` meant tabbing through a form you had not finished accused you of
every field you had passed. It is now `onSubmit`: no validation, no red, until
the first press.

The cost is real and is a library limitation, not a choice —
STACKMYTH-GAPS.md #15. There is no `reValidateMode`, so after that first press a
corrected field cannot clear its own error until the button is pressed again,
and `FormStore.mode` is `private readonly` so it cannot be swapped at runtime.
Mutating a library private through a cast would work today and break on a minor
version.

### 72. Every control in the app is now a Stackmyth component

The profile page shipped with native `<select>` elements, which is exactly what
they looked like: browser chrome in the middle of a styled page. They are
`Select` now, using `SelectItem value=""` for the "follow my browser" option —
verified against the source rather than assumed, since many select
implementations reject an empty value. Stackmyth's `labelsMap.get("")` resolves
it like any other.

A sweep confirms no raw `<input>`, `<select>`, `<textarea>` or `<button>`
survives outside comments. The `<form>` element itself is still hand-written,
which remains a genuine gap (#10) rather than an oversight.

---

## Things I chose not to build

Beyond the section 7 list, which I did not touch:

- **Toasts.** `@stackmyth/toast` exists but isn't installed. Inline `Alert`s
  and status text cover every case here without another dependency.
- **Optimistic UI.** Server actions plus `revalidatePath` are fast enough on
  rosters of this size, and optimistic updates on money are a category of bug
  worth avoiding entirely.
- **A payment-method field in the UI.** The column exists and the action accepts
  it, but no form exposes it — nobody asked for it, and section 6 doesn't list
  it. One input away if it turns out to matter.
- **Tests beyond `src/domain/`.** The spec says money-splitting and waitlist
  logic only. The rest was verified by driving the real app in a browser at
  390px through the full definition-of-done flow.

---

## The mistake worth recording

**Every Stackmyth package ships two stylesheets and I imported only one.**

`<pkg>.css` contains rules like `gap: var(--sm-space-5)`; `<pkg>.vars.css`
defines `--sm-space-5`. Importing only the first produces a page with correct
colors, correct borders, correct component variants — and **every gap, padding
and margin silently collapsed to zero**, because an undefined custom property
makes the whole declaration invalid with no warning of any kind.

It reads exactly like "I am using the layout API wrong", which is what I
debugged first. Caught at build-order step 2 on the smoke page, which is
precisely why that step exists. Had it been found at step 8, every layout in the
app would have been suspect at once.

Full write-up, including what API would have prevented it, in
[STACKMYTH-GAPS.md](./STACKMYTH-GAPS.md) #1.
