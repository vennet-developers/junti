/**
 * The owner panel's date range: what "the period" means for every number on it.
 *
 * One resolver, because the alternative is each query interpreting `?rango=`
 * for itself and two cards silently disagreeing about what "ayer" was. The
 * output is a pair of instants, [from, to), and every windowed query filters
 * its rows' CREATION time against exactly this pair.
 *
 * Day-shaped presets ("ayer", a custom start date) are anchored to
 * **America/Bogota midnight**, not UTC and not the server's zone: the product
 * keeps its books in Colombia, and "ayer" to the person reading the panel
 * means the Bogota calendar day. Colombia does not observe DST, so the offset
 * is a constant — which is what makes this computable without a tz database.
 *
 * Unrecognised or malformed input resolves to the default rather than
 * erroring: the params come from a URL, URLs get mangled, and the safe
 * reading of a mangled filter is the view the page always opens with.
 */

/** Bogota is UTC-5, permanently — Colombia abolished DST in 1993. */
const BOGOTA_OFFSET_HOURS = 5;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_RANGE_DAYS = 30;

export type PanelPreset = "30d" | "7d" | "24h" | "ayer" | "custom";

export interface PanelRange {
  from: Date;
  to: Date;
  preset: PanelPreset;
  /** Whole days covered, rounded up — what bucket choice and labels key on. */
  days: number;
}

/** Midnight of `at`'s Bogota calendar day, as an instant. */
export function bogotaMidnight(at: Date): Date {
  const shifted = new Date(at.getTime() - BOGOTA_OFFSET_HOURS * HOUR_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      BOGOTA_OFFSET_HOURS,
    ),
  );
}

function build(from: Date, to: Date, preset: PanelPreset): PanelRange {
  return {
    from,
    to,
    preset,
    days: Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS)),
  };
}

export function resolveRange(
  input: { rango?: string; desde?: string },
  now: Date,
): PanelRange {
  if (input.desde && /^\d{4}-\d{2}-\d{2}$/.test(input.desde)) {
    const [year, month, day] = input.desde.split("-").map(Number);
    const from = new Date(Date.UTC(year!, month! - 1, day!, BOGOTA_OFFSET_HOURS));

    // A start after now would make an empty-by-construction range that reads
    // as "the product died today". A typo is not a verdict; fall back.
    if (!Number.isNaN(from.getTime()) && from.getTime() < now.getTime()) {
      return build(from, now, "custom");
    }
  }

  switch (input.rango) {
    case "24h":
      return build(new Date(now.getTime() - DAY_MS), now, "24h");

    case "ayer": {
      const today = bogotaMidnight(now);
      return build(new Date(today.getTime() - DAY_MS), today, "ayer");
    }

    case "7d":
      return build(new Date(now.getTime() - 7 * DAY_MS), now, "7d");

    default:
      return build(new Date(now.getTime() - DEFAULT_RANGE_DAYS * DAY_MS), now, "30d");
  }
}

/**
 * How the range's series should be bucketed.
 *
 * Weekly bars over a 24-hour range would draw one bar and call it a trend;
 * daily bars over three months would draw an unreadable comb. The cut at two
 * weeks keeps the default 30-day view drawing weekly, exactly as it always
 * has, while a week filters down to seven honest daily bars.
 */
export function bucketOf(range: PanelRange): "day" | "week" {
  return range.days <= 14 ? "day" : "week";
}
