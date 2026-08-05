# Google Calendar sync — the design, and the gate it is waiting behind

> **Status: designed, not built, and deliberately so.** This document is AC-2,
> AC-3 and AC-6 of *Google Calendar sync for events*. AC-1 gates the code on
> adoption data, that data did not exist and could not exist, and building the
> instrument that produces it was the useful work available today. What follows
> is the decision written down first, which is the card's own guidance: the
> decision is free, the rework is not.

---

## AC-1 — the gate, and why it could not be evaluated

The card opens with *"gated on ICS adoption data showing real demand"*, and
until 2026-08-05 there was no such data and no mechanism that could produce
any. The calendar file existed **only as an email attachment**. The only
measurable number was how many emails went out, which says nothing at all about
whether one person ever put a Junti event into a calendar.

Worse, the population that could have been measured was the wrong one. Most
people arrive from a WhatsApp link and never receive any email, so for the
majority of participants the calendar feature did not exist to be adopted.

**What shipped instead of the sync:**

- `GET /e/:public_token/calendar.ics` — the event as a downloadable file, on the
  page everybody already opens.
- A visible "Agregar a mi calendario" control on the participant page.
- `calendar_added` (server-side, `{ event_id, cancelled }`) in the analytics
  taxonomy — see `ANALYTICS.md`.

`cancelled` is separated for a reason worth stating: somebody fetching a CANCEL
to clear a dead event out of their calendar is not evidence of demand for sync,
and folding the two together would flatter the exact number this exists to keep
honest.

### What the gate should mean before anybody writes OAuth code

Proposed, and open to being argued down — the point is that a threshold exists
in writing **before** the data arrives, so it cannot be chosen afterwards to
justify a decision already taken:

| Signal | Threshold | Why this one |
| --- | --- | --- |
| Share of participants who download | **≥ 15%** of people who open an event page | Below this, calendar is a minority habit and sync is a large build for a few |
| Repeat downloaders | **≥ 30%** of downloaders do it more than once | One download is curiosity; two is a habit, and sync only pays off for habits |
| Organizer pull | any unprompted request for it | The strongest signal and the only qualitative one |

**Measure for at least one full cycle of a recurring event** — for weekly
football that is six to eight weeks. A single week is a novelty reading.

---

## AC-2 — scopes, minimised and requested at the point of use

### The scope

**`https://www.googleapis.com/auth/calendar.events`** and nothing else.

| Scope | Verdict | Why |
| --- | --- | --- |
| `calendar.events` | **use this** | Create and update events the app itself created. It is what the feature is |
| `calendar` | rejected | Full read/write over every calendar, including reading everything the user already has. We need none of it |
| `calendar.readonly` | rejected | We never read their calendar. Free/busy is explicitly out of scope on the card |
| `calendar.events.owned` | considered | Narrower, but limited to events the user owns; a Junti event lands in their calendar as one they were invited to |

`calendar.events` is classified by Google as **sensitive** (not restricted).
That distinction is the whole of AC-6 and is covered below.

### Incremental, at the point of use

This is already the architecture, by accident rather than by plan, and it is
worth not losing: `signInWithOAuth` in `src/components/sign-in-form.tsx`
requests **no additional scopes** — just the default identity ones Supabase
needs. Nobody is asked for calendar access at sign-up.

The rule for when it ships:

- The consent screen appears **only** when somebody presses "keep this in sync",
  on an event, once.
- The button is offered only after a person has downloaded at least one `.ics`.
  Asking for calendar access from somebody who has never shown interest in
  calendars is how an app trains people to say no to everything.
- **Refusal is not an error state.** Declining leaves the download exactly where
  it was, with no banner, no badge, and no second ask on the next event.

---

## AC-3 — the conflict strategy, written before the code

### Junti is the source of truth. Always.

An event's time, place, title and cancellation live in Junti's database, because
that is where the roster, the split and the payments hang off them. The Google
copy is a **projection**, not a replica.

### What happens when the user edits the Google-side copy

Four cases, and only the first is interesting:

| What they did in Google | What Junti does | Why |
| --- | --- | --- |
| Moved the time, changed the title or the place | **Overwrites it on the next sync**, and tells them once | The roster answered "yes" to Junti's time. If the Google copy could win, the twelve people who confirmed would be holding a different plan from the organizer |
| Deleted the event from their calendar | **Does not put it back**, and stops syncing that event for that person | Deleting is a clear instruction. Restoring it on the next pass is the single most infuriating thing a sync can do |
| Marked themselves as declining in Google | **Ignored.** The RSVP lives in Junti | Two answer mechanisms for one question is how a roster ends up disagreeing with itself. The event page is the only place an answer counts |
| Changed their own reminders, colour, notes | **Left alone forever** | Personal settings on their copy. Junti writes the fields it owns and touches nothing else |

**Telling them once is load-bearing.** A silent overwrite makes the app look
broken — somebody moved a thing, it moved back, nobody said anything. One
notification, in the inbox that now exists, naming what was restored and why:
*"Ese evento lo maneja el organizador en Junti, así que tu cambio en el
calendario se revirtió."*

### Which fields Junti writes

`summary`, `start`, `end`, `location`, `description`, `status`, and nothing
else. No attendees — **explicitly not attendees.** Writing the roster into a
Google event would hand every participant's email address to every other
participant's calendar, which is precisely the sharing this product was
redesigned to stop doing. The roster stays on the event page.

---

## AC-4 — tokens, revocation, and the floor underneath it

- The refresh token is stored per account, encrypted at rest, in its own table.
  It is not in `user_preferences`: a credential and a language setting do not
  belong in the same row.
- Google returns a refresh token **only on the first consent**, unless
  `prompt=consent` is forced. Losing it means the connection silently dies in an
  hour. Whatever stores it must treat a missing refresh token as a failed
  connection, not a successful one.
- **Revocation degrades to ICS with no data loss, and that is easy here for a
  structural reason: the download is the floor and the sync is the extra.**
  Somebody who revokes access in their Google account settings loses the
  syncing, keeps every event, and keeps a working "add to my calendar" button.
  Nothing in Junti's own data depends on the connection existing.
- A 401 from Google is a revocation until proven otherwise: mark the connection
  dead, stop retrying, tell them once. A sync that keeps hammering a revoked
  token is how an app gets its OAuth client suspended.

## AC-5 — idempotency

Junti already has the identifier this needs. The ICS `UID` is
`{event.id}@junti.vennet.dev`, and Google's `import` accepts an `iCalUID`
and will replace rather than duplicate. Storing Google's returned `eventId`
per (account, event) is the belt to that: sync becomes an upsert keyed on a
pair we control, and re-running it changes nothing.

`calendar_sequence` — already incremented on every edit and on cancellation for
the ICS — is what tells the update apart from a no-op.

---

## AC-6 — what Google's review actually costs

**This is the part that makes the card L-effort, and it is not code.**

`calendar.events` is a **sensitive** scope. That means:

- The OAuth consent screen must be moved from "testing" to "in production",
  which triggers **OAuth app verification**.
- Required before submitting: a **verified domain**, a **privacy policy at a URL
  on that domain** that specifically explains what Google user data is used for,
  a working **app homepage**, and a **demo video** showing the consent flow and
  what the app does with the data.
- Google's stated turnaround for sensitive scopes is **several weeks**, and it
  is a correspondence process — they ask questions, the clock restarts.
- **Unverified, the app is capped at 100 test users** and everybody sees an
  "unverified app" warning screen. For a product whose whole pitch is "no
  passwords, no friction", that screen is worse than not having the feature.

Restricted scopes (`calendar` full access) would additionally require an annual
third-party **security assessment**, priced in the thousands of dollars. This is
the single strongest argument for `calendar.events` and against the broader
scope — see AC-2.

### What Junti already has, and what it does not

| Requirement | State |
| --- | --- |
| Public homepage | **Ready.** The landing page ships |
| Privacy policy at a public URL | **Ready** — `/privacy`, public and indexable on purpose |
| Privacy policy mentions Google user data specifically | **Not yet.** It describes what Junti collects; it says nothing about calendar data, because there is none |
| Verified domain in Google Search Console | **Unknown — Ivan's to confirm** |
| Demo video | **Not made** |
| Google Cloud project with an OAuth client | **Unknown — Ivan's to confirm** |

**Budget honestly: a few days of build against several weeks of waiting.** The
review is the schedule, not the code.

---

## What is deliberately NOT in this design

- **Two-way sync.** Out of scope on the card, and the conflict table above is
  why: every case resolves towards Junti, so a second direction has nothing to
  carry.
- **Free/busy lookup.** Out of scope, and it needs a broader scope than the one
  chosen.
- **Outlook and Apple.** Out of scope. Both already work through the download,
  which is the argument for the download having been the right first move.
- **Syncing for participants who have not asked.** The consent is per person and
  per connection. An organizer connecting their calendar syncs **their** copy,
  never anybody else's.
