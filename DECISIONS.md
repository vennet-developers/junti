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
says don't build what isn't in section 6. The field is a hidden input; changing
the default is a one-line edit.

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
