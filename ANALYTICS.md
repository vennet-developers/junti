# Analytics — the event taxonomy

> **Status: instrumented.** This document is AC-1 of *Instrument product
> funnel analytics* and was written before any code on purpose: renaming an
> event after data accumulates loses the history it was collected for, and a
> property added later is null for everything before it.
>
> The taxonomy is enforced by a closed union in `src/domain/analytics.ts`, with
> tests asserting the two cannot drift. Adding a name here means adding it
> there, and vice versa.

## What this is for

Two questions, and the taxonomy is designed backwards from them:

1. **Where do participants drop?** Between receiving a link and being counted
   as coming.
2. **Where do organizers abandon?** Between landing on the page that explains
   the product and having an event that exists.

Anything that does not help answer one of those is not in the list. The
temptation with analytics is to record everything because storage is cheap and
then discover that nothing is comparable; this is deliberately small.

---

## The rules

**Names are `noun_verb_past`**, lower snake case: `event_created`, not
`createEvent` or `Event Created`. One shape, so nobody has to remember which.

**Every event carries the same envelope**, and the envelope is not repeated in
each definition below:

| Property | Type | Notes |
| --- | --- | --- |
| `name` | string | From the closed list below. Not free text. |
| `at` | timestamptz | Server clock, always. A client clock is a guess and sometimes a lie. |
| `actor_id` | uuid \| null | The signed-in account. Null for a visitor who has not signed in. |
| `source` | `"server"` \| `"client"` | AC-6. Which layer fired it. |
| `props` | jsonb | Per-event, and constrained by the rules below. |

**No PII in `props`.** Not a name, not an email, not a phone, not free text a
person typed. Ids and enums only. The reason is AC-5 and it is not negotiable:
an analytics table is the one place in this app nobody thinks to check before
exporting, and the moment it holds a display name it becomes another copy of
the roster with none of the protections.

**Money events are server-only.** A client can lie about a payment and a
browser extension can block the call. Anything that would be read as revenue
is fired where the write happens.

**One event per real thing.** A retry is not a second event. A page that
re-renders is not a second view.

---

## The organizer funnel

| Event | Fired | `props` |
| --- | --- | --- |
| `landing_viewed` | Client, on `/` — which only renders for a visitor with no session | `{}` |
| `create_started` | Client, when `/new` renders for a signed-in organizer | `{ from_duplicate: boolean }` |
| `create_step_viewed` | Client, on each wizard step | `{ step: 1\|2\|3 }` |
| `create_step_completed` | Client, when a step validates and advances | `{ step: 1\|2\|3 }` |
| `create_abandoned` | Client, on unload with a started-but-unfinished form | `{ last_step: 1\|2\|3 }` |
| `event_created` | **Server**, in `createEventFn` after the transaction | `{ event_id, has_cost: boolean, cost_mode, has_group: boolean, policy_count: number }` |
| `event_edited` | **Server**, in `editEvent` | `{ event_id, changed: string[] }` — field names, never values |
| `event_closed` | **Server**, in `setEventClosed` | `{ event_id, closed: boolean }` |
| `event_cancelled` | **Server**, in `cancelEvent` | `{ event_id }` |

The three `create_step_*` events are the whole reason the wizard card lists
analytics as a dependency: without them "the simplified form is better" is an
assertion. They are the only events here that would be worth building even if
nothing else on this list ever ships.

## The participant funnel

| Event | Fired | `props` |
| --- | --- | --- |
| `invite_sent` | **Server**, in `inviteToEvent`, one per recipient | `{ event_id, group_id, batch_size }` |
| `event_viewed` | Client, on `/e/:public_token` | `{ event_id, is_participant: boolean, arrived_from: "invite"\|"link" }` |
| `rsvp_started` | Client, on first interaction with the RSVP control | `{ event_id }` |
| `rsvp_completed` | **Server**, in `submitRsvp` and `joinOneTap` | `{ event_id, attendance, one_tap: boolean, waitlisted: boolean }` |
| `policy_submitted` | **Server**, in `submitPolicyResponse` | `{ event_id, policy_slug, has_evidence: boolean }` |
| `policy_reviewed` | **Server**, in `reviewSubmission` | `{ event_id, decision }` |
| `payment_recorded` | **Server**, in `setPaymentStatus` | `{ event_id, status, method }` — never the amount |

`arrived_from` is the join between the two funnels: it is what makes "we sent
400 invitations and 60 people came" decomposable into "how many opened" and
"how many of those answered".

## Calendar

| Event | Fired | `props` |
| --- | --- | --- |
| `calendar_added` | **Server**, in `/e/:public_token/calendar.ics` | `{ event_id, cancelled: boolean }` |

**This one is a gate, not a funnel step.** *Google Calendar sync for events*
opens with "gated on ICS adoption data showing real demand", and until this
existed there was no such data and no way for there to be any — the calendar
file was an email attachment only, so the only measurable number was how many
emails went out, which says nothing about whether anybody ever put a Junti
event in a calendar.

Server-side because a download either happened or it did not, and a click
handler can be blocked by an extension. `actor_id` is usually null: the route
works without a session, matching the page it hangs off, and inventing an actor
would make the count wrong in the other direction.

`cancelled` separates the two files this route can serve. A CANCEL fetched by
somebody clearing an old event out of their calendar is not evidence of demand
for calendar sync, and counting the two together would flatter the number this
exists to keep honest.

## Held spots

| Event | Fired | `props` |
| --- | --- | --- |
| `spot_held` | **Server**, in `holdSpots` | `{ event_id, count }` |
| `spot_claimed` | **Server**, in the claim route | `{ event_id }` |

The growth loop's own funnel: spots held over spots claimed is the conversion
of "my friend reserved for me" into "I have an account". Guest names never
appear in `props` — they are the one datum this feature touches that can
belong to a non-user, and this table is the last place it may ever land.

## Settlement

| Event | Fired | `props` |
| --- | --- | --- |
| `settlement_requested` | **Server**, in `requestSettlement` | `{ event_id, owed, sent }` |

One press of "Pedir el saldo por correo". `owed` is how many attendees the
split says still lack part of the dropout gap; `sent` is how many actually
received an email (verified address, not suppressed, not a same-day repeat).
The distance between the two numbers is the feature's coverage, which is why
both travel.

## Push

| Event | Fired | `props` |
| --- | --- | --- |
| `push_enabled` | **Server**, in `savePushSubscriptionFn` | `{}` |

One device turned alerts on. No endpoint, no user agent in `props` — the
subscription row holds those, and this table only needs to answer "is anyone
using this".

| `app_installed` | Client, on the browser's `appinstalled` event | `{}` |

Whether the install offer converts. Client because only the browser knows;
Chrome-family only, which is also the only family that can install from the
page. iOS installs are invisible to this — a manual "Add to Home Screen"
fires no event — so the number is a floor, not a total.

## Groups

| Event | Fired | `props` |
| --- | --- | --- |
| `group_created` | **Server**, in `createGroup` | `{ group_id }` |
| `group_link_viewed` | Client, on `/g/:join_token` | `{ group_id, state }` — the `GroupJoinState` |
| `group_answered` | **Server**, in `answerGroup` | `{ group_id, answer }` |
| `group_left` | **Server**, in `leaveGroup` | `{ group_id }` |

`group_answered` with `answer: "declined"` is the one number that says whether
the consent model costs reach. If most people decline, groups are friction
rather than a feature, and that is worth knowing early.

---

## What is deliberately NOT instrumented

- **Page views in general.** This is not a content site; a view that is not one
  of the funnel steps above answers nothing.
- **Anything on `/privacy`, `/unsubscribe` or the auth callback.** Somebody
  exercising a privacy right must not be measured for it.
- **Amounts of money.** `payment_recorded` carries the status, never the value.
  The ledger is where money lives and it is already exact; a second, weaker
  copy in an analytics table is a liability with no upside.
- **Sessions, scroll depth, clicks, heatmaps.** None of them answer the two
  questions.

## Two ACs that were written for an app that no longer exists

The card predates *Accounts required to RSVP*, and two of its criteria describe
the world before it:

- **AC-3, "every event carries the anonymous participant id, so pre-account and
  post-account behaviour joins into a single funnel."** There is no anonymous
  participant any more — the whole flow was removed. The join it asks for
  happens on `actor_id`, which is the account, and the pre-account half of the
  funnel is now genuinely anonymous: an `event_viewed` from a visitor who has
  not signed in has `actor_id: null` and cannot be joined to anything later.
  **That is a real, accepted loss of resolution**, not an oversight: the
  alternative is a tracking cookie set before consent, which is precisely what
  this app spent a whole card getting rid of.
- **AC-2's "email captured" step.** Email is captured at sign-up now, not part
  way through an RSVP. The step is `rsvp_completed`.

## AC-7 — behaviour under withdrawn consent

Withdrawal in this app is `email_suppressions` (per address) and the WhatsApp
consent revocation (per account). Neither is consent for analytics, because
analytics here does not process personal data: the envelope holds an account id
or nothing at all, and `props` holds ids and enums.

**So there is nothing to withdraw from, and that is the design, not a loophole.**
If a future event ever needs a name, a message body or an amount in `props`,
this section stops being true and the answer changes with it.

A deletion request removes the account and its rows; analytics events keyed on
`actor_id` are anonymised by the same runbook step that anonymises the roster —
set `actor_id` to null rather than deleting the row, because the funnel counts
are what the events are for and one fewer denominator is a silently wrong
number.

## Two events that were removed with the feature they measured

`welcome_step_viewed` and `welcome_finished` measured `/welcome`, a
session-gated three-screen explainer. That route is gone: the landing page
explains the same thing publicly, at more length, and without asking a stranger
to sign in first — see `ROUTES.howItWorks`. Removing the events with it rather
than leaving two names in a closed union that nothing can ever fire again.

Any rows already recorded under those names stay in `analytics_events` until
the retention job reaches them. They are historical and harmless; nothing reads
them.
