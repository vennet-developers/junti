import "@/server/assert-server";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { delta, projectNext30, share } from "@/domain/chart";
import { bucketOf, type PanelRange } from "@/domain/panel-range";

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

/** Answers by kind, for the segment bar. The roster's own vocabulary. */
export interface AttendanceSplit {
  going: number;
  maybe: number;
  notGoing: number;
  waitlisted: number;
}

export interface OverviewReport {
  days: number;
  /** The applied range, echoed back so the page can label and highlight. */
  range: { fromISO: string; toISO: string; preset: string };
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
  attendance: AttendanceSplit;
}

/**
 * The comparison window: same length as the range, ending where it starts.
 * "¿Subió?" only means something against a stretch of the same size.
 */
function previousFrom(range: PanelRange): Date {
  return new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime()));
}

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
 * Every window is [from, to) on the row's CREATION time — the one rule the
 * whole panel filters by.
 */
async function headlines(range: PanelRange) {
  // ISO strings, not Date objects: the raw-sql path binds parameters without
  // column type info, and postgres.js refuses a bare Date there. Postgres
  // infers timestamptz from the comparison context.
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const prev = previousFrom(range).toISOString();

  const [row] = await db.execute<Record<string, string>>(sql`
    select
      (select count(*) from user_profiles)::text as accounts_total,
      (select count(*) from user_profiles where created_at >= ${from} and created_at < ${to})::text as accounts_win,
      (select count(*) from user_profiles where created_at >= ${prev}
         and created_at < ${from})::text as accounts_prev,
      (select count(*) from events)::text as events_total,
      (select count(*) from events where created_at >= ${from} and created_at < ${to})::text as events_win,
      (select count(*) from events where created_at >= ${prev}
         and created_at < ${from})::text as events_prev,
      (select count(*) from participants)::text as rsvps_total,
      (select count(*) from participants where created_at >= ${from} and created_at < ${to})::text as rsvps_win,
      (select count(*) from participants where created_at >= ${prev}
         and created_at < ${from})::text as rsvps_prev,
      (select count(*) from groups)::text as groups_total,
      (select count(*) from groups where created_at >= ${from} and created_at < ${to})::text as groups_win,
      (select count(*) from groups where created_at >= ${prev}
         and created_at < ${from})::text as groups_prev
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
 *
 * The bucket follows the range: a filtered week draws seven daily bars, the
 * default month draws its weeks — see `bucketOf`. Only rows created inside
 * the range count toward a bucket, so a bucket the range half-covers reports
 * the covered half rather than smuggling the rest back in.
 */
async function series(range: PanelRange, bucket: "day" | "week") {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const unit = sql.raw(`'${bucket}'`);
  const step = sql.raw(bucket === "day" ? "interval '1 day'" : "interval '1 week'");

  const rows = await db.execute<{
    week: Date;
    accounts: string;
    events: string;
    rsvps: string;
  }>(sql`
    with calendar as (
      select generate_series(
        date_trunc(${unit}, ${from}::timestamptz),
        date_trunc(${unit}, ${to}::timestamptz),
        ${step}
      ) as week
    )
    select
      c.week,
      (select count(*) from user_profiles u
         where date_trunc(${unit}, u.created_at) = c.week
           and u.created_at >= ${from} and u.created_at < ${to})::text as accounts,
      (select count(*) from events e
         where date_trunc(${unit}, e.created_at) = c.week
           and e.created_at >= ${from} and e.created_at < ${to})::text as events,
      (select count(*) from participants p
         where date_trunc(${unit}, p.created_at) = c.week
           and p.created_at >= ${from} and p.created_at < ${to})::text as rsvps
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
/*
  Email counts come from `analytics_events`, NOT from `outbox_messages`, and
  the difference is the whole reason these numbers can be trusted:

  - The outbox is a QUEUE. Retention deletes its sent rows at thirty days, so
    "total enviados" read from there was really "enviados este mes" wearing a
    lifetime label, shrinking quietly as the job ran.
  - Auth mail never enters the outbox at all. Supabase calls the send-email
    hook and we send straight through the provider, so every sign-in link —
    the single most-sent message in this product — was missing from the
    figure entirely. That gap is why "el magic link no llegó" had to be
    answered from Supabase's own service logs.

  The events are kept a year and cover both paths, template by template.
*/
async function moneyAndEmails(range: PanelRange): Promise<{ money: MoneyFlow; emails: Omit<Emails, "weekly"> }> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const prev = previousFrom(range).toISOString();

  const [row] = await db.execute<Record<string, string>>(sql`
    select
      coalesce(sum(p.amount_minor) filter (where p.status = 'confirmed'), 0)::text as confirmed,
      coalesce(sum(p.amount_minor) filter (where p.status in ('confirmed','pending')), 0)::text as tracked,
      coalesce(sum(p.amount_minor) filter (
        where p.status = 'confirmed' and p.confirmed_at >= ${from} and p.confirmed_at < ${to}
      ), 0)::text as window_confirmed,
      (select count(*) from analytics_events where name = 'email_sent')::text as sent_total,
      (select count(*) from analytics_events where name = 'email_sent'
         and at >= ${from} and at < ${to})::text as sent_win,
      (select count(*) from analytics_events where name = 'email_sent'
         and at >= ${prev} and at < ${from})::text as sent_prev,
      (select count(*) from analytics_events where name = 'email_failed')::text as failed,
      (select count(*) from analytics_events where name = 'email_suppressed')::text as suppressed
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

/** Answers by kind — answers GIVEN inside the range, per the one filter rule. */
async function attendanceSplit(range: PanelRange): Promise<AttendanceSplit> {
  const [row] = await db.execute<Record<string, string>>(sql`
    select
      count(*) filter (where attendance = 'in')::text as going,
      count(*) filter (where attendance = 'maybe')::text as maybe,
      count(*) filter (where attendance = 'out')::text as not_going,
      count(*) filter (where attendance = 'waitlisted')::text as waitlisted
    from participants
    where created_at >= ${range.from.toISOString()} and created_at < ${range.to.toISOString()}
  `);
  return {
    going: Number(row?.going ?? 0),
    maybe: Number(row?.maybe ?? 0),
    notGoing: Number(row?.not_going ?? 0),
    waitlisted: Number(row?.waitlisted ?? 0),
  };
}

/** Sent emails per bucket, on the same generated calendar as `series`. */
async function emailSeries(range: PanelRange, bucket: "day" | "week"): Promise<SeriesPoint[]> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const unit = sql.raw(`'${bucket}'`);
  const step = sql.raw(bucket === "day" ? "interval '1 day'" : "interval '1 week'");

  const rows = await db.execute<{ week: Date; total: string }>(sql`
    with calendar as (
      select generate_series(
        date_trunc(${unit}, ${from}::timestamptz),
        date_trunc(${unit}, ${to}::timestamptz),
        ${step}
      ) as week
    )
    select c.week,
      (select count(*) from analytics_events o
         where o.name = 'email_sent' and date_trunc(${unit}, o.at) = c.week
           and o.sent_at >= ${from} and o.sent_at < ${to})::text as total
    from calendar c order by c.week
  `);

  return [...rows].map((row) => ({
    label: new Date(row.week)
      .toLocaleDateString("es-CO", { day: "numeric", month: "short" })
      .replace(" de ", " "),
    value: Number(row.total),
  }));
}


export async function loadOverview(range: PanelRange): Promise<OverviewReport> {
  const bucket = bucketOf(range);

  /*
    Sequential, deliberately. Awaiting one at a time against a pool of five
    leaves room for the funnel's own queries; firing everything at once is
    what produced the timeout described above.
  */
  const totals = await headlines(range);
  const buckets = await series(range, bucket);
  const depthRows = await depth();
  const flows = await moneyAndEmails(range);
  const bucketEmails = await emailSeries(range, bucket);
  const attendance = await attendanceSplit(range);

  /*
    "Al ritmo actual" is a statement about NOW, not about the filtered
    period: the pace comes from the trailing completed weeks whatever the
    range says, or the projection under a one-day filter would divine the
    next month from yesterday. When the visible series is already weekly it
    is reused; a short range pays one extra query for its own weekly view.
  */
  const paceWeeks =
    bucket === "week"
      ? buckets
      : await series(
          { ...range, from: new Date(range.to.getTime() - 56 * 24 * 60 * 60_000), to: range.to },
          "week",
        );

  return {
    days: range.days,
    range: {
      fromISO: range.from.toISOString(),
      toISO: range.to.toISOString(),
      preset: range.preset,
    },
    ...totals,
    ...buckets,
    depth: depthRows,
    money: flows.money,
    emails: { ...flows.emails, weekly: bucketEmails },
    projection: {
      accountsNext30: projectNext30(paceWeeks.weeklyAccounts),
      eventsNext30: projectNext30(paceWeeks.weeklyEvents),
      rsvpsNext30: projectNext30(paceWeeks.weeklyRsvps),
    },
    attendance,
  };
}
