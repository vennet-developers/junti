import "@/server/assert-server";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { delta, projectNext30, share } from "@/domain/chart";

/**
 * The state of the system, and whether it is moving.
 *
 * **A different question from the funnel, which is why it is a different
 * module.** `funnel.ts` reads `analytics_events` and asks where people drop;
 * this reads the domain tables and asks how much there is and whether it grows.
 * The two disagree on purpose: analytics is what somebody did, and these are
 * the things that exist. An event created before the taxonomy shipped has no
 * `event_created` row and is still an event.
 *
 * **Totals are vanity and depth is the decision.** A count of accounts only
 * ever goes up, so it cannot tell anybody to do anything. The block at the
 * bottom — organizers who came back for a second event, participants who
 * joined a second one — is the part that answers "does this work", and it is
 * the reason this module exists rather than four `count(*)` calls in the page.
 */

export interface Metric {
  total: number;
  /** Inside the window. */
  window: number;
  /** The window before it, same length. */
  previous: number;
  /** Percentage change against `previous`, or null when there is nothing to compare. */
  change: number | null;
}

export interface SeriesPoint {
  /** Week start, already formatted for the axis. */
  label: string;
  value: number;
}

export interface Depth {
  /** Organizers who created more than one event, ever. */
  repeatOrganizers: number;
  /** …out of how many organizers there are. */
  organizers: number;
  repeatOrganizerPercent: number | null;
  /** Accounts that joined more than one event. */
  repeatParticipants: number;
  participants: number;
  repeatParticipantPercent: number | null;
  /** Average confirmed attendance per event, over events that have any. */
  averageAttendance: number | null;
  /** Share of events that cost something. */
  paidEventPercent: number | null;
  /** Median hours between an event being created and its first answer. */
  medianHoursToFirstRsvp: number | null;
}

/**
 * The money the platform coordinates without ever touching.
 *
 * The closest thing Junti has to GMV, and the number that decides whether
 * monetization is ever worth building: a platform coordinating serious money
 * has something to charge a fee against, and one coordinating pizza budgets
 * does not. `confirmedMinor` is money an organizer said arrived; `trackedMinor`
 * adds what is still owed. Waived amounts are excluded from both — money
 * nobody will pay is not volume.
 */
export interface MoneyFlow {
  confirmedMinor: number;
  trackedMinor: number;
  /** Confirmed inside the window, for the trend. */
  windowConfirmedMinor: number;
}

/** Delivery, which is also the app's one real marginal cost. */
export interface Emails {
  sent: Metric;
  failed: number;
  suppressed: number;
  /** Sent per week, for the sparkline. */
  weekly: SeriesPoint[];
}

/**
 * Next 30 days, extrapolated from the trailing four weeks.
 *
 * A straight average of the recent weekly rate — deliberately NOT a fitted
 * curve. With weeks of data a regression is confidence theater; the honest
 * statement is "at the current pace". Null until there are at least two
 * non-empty weeks, because a pace needs more than one step to exist.
 */
export interface Projection {
  accountsNext30: number | null;
  eventsNext30: number | null;
  rsvpsNext30: number | null;
}

export interface OverviewReport {
  days: number;
  accounts: Metric;
  events: Metric;
  rsvps: Metric;
  groups: Metric;
  weeklyAccounts: SeriesPoint[];
  weeklyEvents: SeriesPoint[];
  weeklyRsvps: SeriesPoint[];
  depth: Depth;
  money: MoneyFlow;
  emails: Emails;
  projection: Projection;
}

/** Postgres interval literals, built from a number this module controls. */
const days = (n: number) => sql.raw(`interval '${Number(n)} days'`);

/**
 * Every headline number in ONE query, and every series in a second.
 *
 * **Not a micro-optimisation — the first version did not work.** It ran a
 * query per table per shape, eight of them through `Promise.all`, on top of
 * the funnel's six. `db/client.ts` documents what happens next, measured
 * against this very project: the transaction pooler stalls past roughly ten
 * concurrent statements and they die on the server's statement timeout. The
 * page returned a 500 saying the database was unreachable, which was true and
 * self-inflicted.
 *
 * Subselects over four tiny tables cost one round trip and nothing else.
 */
async function headlines(window: number) {
  const [row] = await db.execute<Record<string, string>>(sql`
    select
      (select count(*) from user_profiles)::text as accounts_total,
      (select count(*) from user_profiles where created_at > now() - ${days(window)})::text as accounts_win,
      (select count(*) from user_profiles where created_at > now() - ${days(window * 2)}
         and created_at <= now() - ${days(window)})::text as accounts_prev,
      (select count(*) from events)::text as events_total,
      (select count(*) from events where created_at > now() - ${days(window)})::text as events_win,
      (select count(*) from events where created_at > now() - ${days(window * 2)}
         and created_at <= now() - ${days(window)})::text as events_prev,
      (select count(*) from participants)::text as rsvps_total,
      (select count(*) from participants where created_at > now() - ${days(window)})::text as rsvps_win,
      (select count(*) from participants where created_at > now() - ${days(window * 2)}
         and created_at <= now() - ${days(window)})::text as rsvps_prev,
      (select count(*) from groups)::text as groups_total,
      (select count(*) from groups where created_at > now() - ${days(window)})::text as groups_win,
      (select count(*) from groups where created_at > now() - ${days(window * 2)}
         and created_at <= now() - ${days(window)})::text as groups_prev
  `);

  const pick = (prefix: string): Metric => {
    const win = Number(row?.[`${prefix}_win`] ?? 0);
    const prev = Number(row?.[`${prefix}_prev`] ?? 0);
    return {
      total: Number(row?.[`${prefix}_total`] ?? 0),
      window: win,
      previous: prev,
      change: delta(win, prev),
    };
  };

  return {
    accounts: pick("accounts"),
    events: pick("events"),
    rsvps: pick("rsvps"),
    groups: pick("groups"),
  };
}

/**
 * The three weekly series, with every week present.
 *
 * **The `generate_series` is the point.** Grouping rows by week returns only
 * the weeks that have rows, so a fortnight where nobody signed up simply
 * vanishes and the chart draws over a hole. A generated calendar makes an
 * empty week a zero, which is a fact, rather than a gap, which is a lie about
 * time.
 *
 * All three read off the same calendar in one query, so their bars line up by
 * construction rather than by three separate queries happening to agree.
 */
async function series(window: number) {
  const rows = await db.execute<{
    week: Date;
    accounts: string;
    events: string;
    rsvps: string;
  }>(sql`
    with calendar as (
      select generate_series(
        date_trunc('week', now() - ${days(window)}),
        date_trunc('week', now()),
        interval '1 week'
      ) as week
    )
    select
      c.week,
      (select count(*) from user_profiles u
         where date_trunc('week', u.created_at) = c.week)::text as accounts,
      (select count(*) from events e
         where date_trunc('week', e.created_at) = c.week)::text as events,
      (select count(*) from participants p
         where date_trunc('week', p.created_at) = c.week)::text as rsvps
    from calendar c
    order by c.week
  `);

  /*
    Day and month, and no "de". `toLocaleDateString` in es-CO returns
    "12 de jul", which is correct Spanish and too wide for an axis tick — six
    weeks of it overlap into an unreadable band. The year is the same for
    every point in any window this page offers, so it goes too.
  */
  const label = (week: Date) =>
    new Date(week)
      .toLocaleDateString("es-CO", { day: "numeric", month: "short" })
      .replace(" de ", " ");

  return {
    weeklyAccounts: [...rows].map((r) => ({ label: label(r.week), value: Number(r.accounts) })),
    weeklyEvents: [...rows].map((r) => ({ label: label(r.week), value: Number(r.events) })),
    weeklyRsvps: [...rows].map((r) => ({ label: label(r.week), value: Number(r.rsvps) })),
  };
}

/**
 * The numbers that decide things.
 *
 * Deliberately all-time rather than windowed. "Did organizers come back" is a
 * question about behaviour over a lifetime, and slicing it to thirty days
 * would count somebody's second event as a first one because their first fell
 * outside the window.
 */
async function depth(): Promise<Depth> {
  const [organizers] = await db.execute<{ total: string; repeat: string }>(sql`
    select count(*)::text as total, count(*) filter (where events > 1)::text as repeat
    from (select organizer_id, count(*) as events from events group by organizer_id) as per_organizer
  `);

  /*
    Distinct EVENTS per account, not rows: somebody who changes their answer
    three times on one event has one participation, and counting rows would
    report them as a loyal returning participant.
  */
  const [participants] = await db.execute<{ total: string; repeat: string }>(sql`
    select count(*)::text as total, count(*) filter (where events > 1)::text as repeat
    from (
      select user_id, count(distinct event_id) as events
      from participants where user_id is not null group by user_id
    ) as per_person
  `);

  const [shape] = await db.execute<{ avg_attendance: string | null; paid: string; total: string }>(sql`
    select
      (select avg(confirmed)::numeric(10,1)
         from (
           select count(*) as confirmed from participants
           where attendance = 'in' group by event_id
         ) as sizes)::text as avg_attendance,
      count(*) filter (where cost_mode <> 'none')::text as paid,
      count(*)::text as total
    from events
  `);

  /*
    The median rather than the average, because this distribution has a tail:
    one event created in January for a party in December drags a mean into
    uselessness. `percentile_cont` interpolates, which is what a median of an
    even count should do.
  */
  const [speed] = await db.execute<{ median_hours: string | null }>(sql`
    select percentile_cont(0.5) within group (
      order by extract(epoch from (first_answer - created_at)) / 3600
    )::numeric(10,1)::text as median_hours
    from (
      select e.created_at, min(p.created_at) as first_answer
      from events e join participants p on p.event_id = e.id
      group by e.id, e.created_at
    ) as first_answers
  `);

  const organizerTotal = Number(organizers?.total ?? 0);
  const organizerRepeat = Number(organizers?.repeat ?? 0);
  const participantTotal = Number(participants?.total ?? 0);
  const participantRepeat = Number(participants?.repeat ?? 0);
  const eventTotal = Number(shape?.total ?? 0);

  return {
    organizers: organizerTotal,
    repeatOrganizers: organizerRepeat,
    repeatOrganizerPercent: share(organizerRepeat, organizerTotal),
    participants: participantTotal,
    repeatParticipants: participantRepeat,
    repeatParticipantPercent: share(participantRepeat, participantTotal),
    averageAttendance: shape?.avg_attendance === null ? null : Number(shape?.avg_attendance ?? 0),
    paidEventPercent: share(Number(shape?.paid ?? 0), eventTotal),
    medianHoursToFirstRsvp:
      speed?.median_hours === null || speed?.median_hours === undefined
        ? null
        : Number(speed.median_hours),
  };
}

/** Money and email totals in one round trip — see the wave note below. */
async function moneyAndEmails(window: number): Promise<{ money: MoneyFlow; emails: Omit<Emails, "weekly"> }> {
  const [row] = await db.execute<Record<string, string>>(sql`
    select
      coalesce(sum(p.amount_minor) filter (where p.status = 'confirmed'), 0)::text as confirmed,
      coalesce(sum(p.amount_minor) filter (where p.status in ('confirmed','pending')), 0)::text as tracked,
      coalesce(sum(p.amount_minor) filter (
        where p.status = 'confirmed' and p.confirmed_at > now() - ${days(window)}
      ), 0)::text as window_confirmed,
      (select count(*) from outbox_messages where status = 'sent')::text as sent_total,
      (select count(*) from outbox_messages where status = 'sent'
         and sent_at > now() - ${days(window)})::text as sent_win,
      (select count(*) from outbox_messages where status = 'sent'
         and sent_at > now() - ${days(window * 2)} and sent_at <= now() - ${days(window)})::text as sent_prev,
      (select count(*) from outbox_messages where status = 'failed')::text as failed,
      (select count(*) from outbox_messages where status = 'suppressed')::text as suppressed
    from payments p
  `);

  const sentWin = Number(row?.sent_win ?? 0);
  const sentPrev = Number(row?.sent_prev ?? 0);

  return {
    money: {
      confirmedMinor: Number(row?.confirmed ?? 0),
      trackedMinor: Number(row?.tracked ?? 0),
      windowConfirmedMinor: Number(row?.window_confirmed ?? 0),
    },
    emails: {
      sent: {
        total: Number(row?.sent_total ?? 0),
        window: sentWin,
        previous: sentPrev,
        change: delta(sentWin, sentPrev),
      },
      failed: Number(row?.failed ?? 0),
      suppressed: Number(row?.suppressed ?? 0),
    },
  };
}

/** Sent emails per week, on the same generated calendar as `series`. */
async function emailSeries(window: number): Promise<SeriesPoint[]> {
  const rows = await db.execute<{ week: Date; total: string }>(sql`
    with calendar as (
      select generate_series(
        date_trunc('week', now() - ${days(window)}),
        date_trunc('week', now()),
        interval '1 week'
      ) as week
    )
    select c.week,
      (select count(*) from outbox_messages o
         where o.status = 'sent' and date_trunc('week', o.sent_at) = c.week)::text as total
    from calendar c order by c.week
  `);

  return [...rows].map((row) => ({
    label: new Date(row.week)
      .toLocaleDateString("es-CO", { day: "numeric", month: "short" })
      .replace(" de ", " "),
    value: Number(row.total),
  }));
}


export async function loadOverview(window = 30): Promise<OverviewReport> {
  /*
    Sequential, deliberately. Three awaits against a pool of five leaves room
    for the funnel's own queries; firing everything at once is what produced
    the timeout described above.
  */
  const totals = await headlines(window);
  const weeks = await series(window);
  const depthRows = await depth();
  const flows = await moneyAndEmails(window);
  const weeklyEmails = await emailSeries(window);

  return {
    days: window,
    ...totals,
    ...weeks,
    depth: depthRows,
    money: flows.money,
    emails: { ...flows.emails, weekly: weeklyEmails },
    projection: {
      accountsNext30: projectNext30(weeks.weeklyAccounts),
      eventsNext30: projectNext30(weeks.weeklyEvents),
      rsvpsNext30: projectNext30(weeks.weeklyRsvps),
    },
  };
}
