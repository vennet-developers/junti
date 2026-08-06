/**
 * The call to confirm, and when it closes.
 *
 * **This is not a second way to close an event.** Junti already had one —
 * `closed_at`, set by hand from the organizer panel — and adding an
 * independent deadline would have produced two mechanisms that both mean
 * "nobody else may answer" and can disagree with each other. A deadline is
 * the same fact scheduled in advance, so both live behind one question:
 * {@link rsvpState}.
 *
 * **Computed, never swept.** Nothing writes `closed_at` when a deadline
 * passes. The only scheduled job in this app runs every six hours, and a
 * countdown that promises minutes cannot be backed by a job that is wrong for
 * up to six of them — the page would show 00:00 while the form still took
 * answers. Reading the clock at the moment somebody asks is exact by
 * construction, and it means the countdown on the page and the guard on the
 * server are the same number rather than two things that agree most of the
 * time.
 */

export type RsvpState =
  /** Answers are accepted. */
  | "open"
  /** Called off. Nothing is accepted, and this outranks everything. */
  | "cancelled"
  /** The organizer froze it by hand. */
  | "closed"
  /** The deadline passed. Reversible — see the note on reopening. */
  | "expired";

export interface ConvocationInput {
  cancelledAt: Date | null;
  closedAt: Date | null;
  /** When the call to confirm closes, or null for "no deadline". */
  rsvpDeadline: Date | null;
}

/**
 * Whether this event is taking answers, and if not, why.
 *
 * Order matters and is not alphabetical. Cancelled outranks everything because
 * an event that is not happening is not merely closed; closed-by-hand outranks
 * expired because if an organizer froze it early, that is the reason to show,
 * not the deadline that would have done it later anyway.
 */
export function rsvpState(event: ConvocationInput, now: Date): RsvpState {
  if (event.cancelledAt !== null) return "cancelled";
  if (event.closedAt !== null) return "closed";
  if (event.rsvpDeadline !== null && now.getTime() >= event.rsvpDeadline.getTime()) {
    return "expired";
  }
  return "open";
}

/**
 * The one question every write path asks.
 *
 * A helper rather than four copies of `state === "open"`: the four call sites
 * are in two files and the rule is one sentence, and the version of this that
 * goes wrong is somebody adding a fifth path and checking two of the three
 * conditions.
 */
export function canAnswer(event: ConvocationInput, now: Date): boolean {
  return rsvpState(event, now) === "open";
}

/**
 * Whether a proposed deadline makes sense for an event starting at `startsAt`.
 *
 * Two rules, and both come from what the deadline is FOR. It closes the
 * headcount before the thing happens, so a deadline after kick-off closes
 * nothing — everybody who was coming has already arrived. And a deadline in
 * the past would create an event that is shut on the moment it is born, which
 * is never what somebody typing a date means.
 *
 * Equality is a failure on purpose: a deadline exactly at kick-off is the
 * degenerate case of the first rule, not a clever way to say "until it
 * starts".
 */
export function deadlineProblem(
  deadline: Date,
  startsAt: Date,
  now: Date,
): "past" | "after_start" | null {
  if (deadline.getTime() <= now.getTime()) return "past";
  if (deadline.getTime() >= startsAt.getTime()) return "after_start";
  return null;
}

/**
 * How long before kick-off the call may close, in hours.
 *
 * **The organizer picks a lead, not a date.** "Cierra un día antes" is what
 * somebody means, and it is one tap; the same thing as a date and a time is two
 * pickers and a chance to typo a year. It also survives the event moving: the
 * form re-derives the deadline from the lead every time it saves, so pushing a
 * match from Friday to Saturday carries the deadline with it instead of leaving
 * it stranded in the past.
 *
 * The stored column is still an absolute instant — see the schema — because the
 * countdown and the guards need a moment, not an arithmetic problem. This is
 * the input, not the storage.
 *
 * Closed list on purpose, and small: it is what makes {@link leadFromDeadline}
 * total, so the edit form can always show back exactly what was chosen.
 */
export const LEAD_HOURS = [2, 6, 24, 48, 72, 168] as const;
export type LeadHours = (typeof LEAD_HOURS)[number];

export function isLeadHours(value: number): value is LeadHours {
  return (LEAD_HOURS as readonly number[]).includes(value);
}

/** The instant a call with this lead closes. */
export function deadlineFromLead(startsAt: Date, lead: LeadHours): Date {
  return new Date(startsAt.getTime() - lead * 3_600_000);
}

/**
 * The lead a stored deadline was chosen from, or null if it matches none.
 *
 * Null is reachable in practice even though every deadline this app writes
 * comes from the list: an event whose start time was edited by an older build,
 * or a row touched by hand. The caller shows "otra" rather than silently
 * rounding to the nearest option, which would change a deadline on save without
 * anybody asking for it.
 */
export function leadFromDeadline(startsAt: Date, deadline: Date): LeadHours | null {
  const hours = (startsAt.getTime() - deadline.getTime()) / 3_600_000;
  return isLeadHours(hours) ? hours : null;
}

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds left. Zero once the deadline has passed. */
  totalMs: number;
}

/**
 * How long is left, split into the units a countdown renders.
 *
 * **Never negative.** Two clocks are never identical, and a viewer whose
 * machine runs a few seconds ahead of the server would otherwise see the
 * countdown go past zero into negative numbers — which reads as a bug in a
 * component whose entire job is to be trusted about time. Past the deadline
 * everything is zero and the caller shows the closed state instead.
 *
 * Truncated rather than rounded, which is what a clock does: with 90 seconds
 * left it says one minute and thirty seconds, not two minutes.
 */
export function remaining(deadline: Date, now: Date): Remaining {
  const totalMs = Math.max(0, deadline.getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);

  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

export type CountdownUnit = "day" | "hour" | "minute" | "second";

/**
 * The two units a countdown should actually show.
 *
 * Two, not four. "3 días 0 h 14 min 52 s" makes a reader parse four numbers to
 * learn one thing, and the seconds on a three-day countdown are noise that
 * happens to move. The pair slides down as the deadline approaches — days and
 * hours, then hours and minutes, then minutes and seconds — so the last hour is
 * the only one that ticks visibly, which is also the only hour where a second
 * changes anybody's behaviour.
 *
 * Zeroes are kept inside the pair rather than skipped: "2 días 0 h" is right,
 * and dropping to just "2 días" would make the display jump between one number
 * and two as the hours roll over.
 */
export function countdownParts(left: Remaining): [
  { value: number; unit: CountdownUnit },
  { value: number; unit: CountdownUnit },
] {
  if (left.days > 0) {
    return [
      { value: left.days, unit: "day" },
      { value: left.hours, unit: "hour" },
    ];
  }
  if (left.hours > 0) {
    return [
      { value: left.hours, unit: "hour" },
      { value: left.minutes, unit: "minute" },
    ];
  }
  return [
    { value: left.minutes, unit: "minute" },
    { value: left.seconds, unit: "second" },
  ];
}

/**
 * How urgent the countdown should look.
 *
 * Three tiers rather than a continuous scale, because the only decision a
 * reader makes from this is "do I answer now or later" and three steps is all
 * that supports. The thresholds are hours and not percentages: one hour left
 * feels the same whether the call ran for a day or for three weeks.
 */
export function urgency(left: Remaining): "calm" | "soon" | "urgent" {
  const hoursLeft = left.totalMs / 3_600_000;
  if (hoursLeft <= 1) return "urgent";
  if (hoursLeft <= 24) return "soon";
  return "calm";
}
