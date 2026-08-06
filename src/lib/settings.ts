import "@/server/assert-server";

import { db } from "@/db/client";
import { appSettings } from "@/db/schema";

/**
 * The numbers that must be changeable without a deploy.
 *
 * AC-3 of the send-limits card. The limits were constants in the source, which
 * meant that turning one down — the useful response to somebody abusing the
 * send path — required a commit, a build and a deploy, at the worst possible
 * moment.
 *
 * **The defaults live here, in code.** A row in `app_settings` is an override,
 * not the source of truth, so an empty table is a working app and deleting a
 * row is how you undo a change. That is the opposite of a config system where
 * production behaviour lives in a table nobody can review.
 */

/**
 * Every setting, with its default and what it protects.
 *
 * A closed record rather than free-text keys: a typo in a key would silently
 * read the default forever, which is the failure mode where a limit you think
 * you lowered is still wide open.
 */
export const SETTINGS = {
  /**
   * Invitations one organizer may send in an hour, across all their events.
   *
   * Counted per organizer rather than per event on purpose — spreading an
   * afternoon of sends across five events they created would otherwise cost
   * nothing.
   */
  invitesPerHour: { key: "invites_per_hour", default: 100 },
  /** Spots one participant may hold for guests on a single event. */
  maxHeldSpots: { key: "max_held_spots", default: 5 },

  /**
   * How many people one click may reach.
   *
   * A ceiling on the blast radius of a single press. Groups already bound this
   * from the other side — nobody is invitable who did not join — so this is
   * now the milder of the two guards.
   */
  maxInvitesPerSend: { key: "max_invites_per_send", default: 20 },
} as const;

export type SettingName = keyof typeof SETTINGS;

/**
 * Cached for a minute.
 *
 * A send already talks to the database, so one more small read would not be
 * the end of the world — but this one is on the path of a batch of twenty and
 * would be read twenty-one times for no new information. A minute is short
 * enough that "turn it down now" still means now.
 */
const CACHE_MS = 60_000;

let cache: { at: number; values: Map<string, number> } | null = null;

async function load(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.values;

  try {
    const rows = await db.select().from(appSettings);
    const values = new Map(rows.map((row) => [row.key, row.value]));
    cache = { at: Date.now(), values };
    return values;
  } catch {
    /*
      Falls back to the defaults rather than failing, and that is the right way
      round: the limiter itself fails closed, so a database that cannot be read
      already refuses every send. Making this throw as well would turn one
      failure into two with no extra protection.
    */
    return cache?.values ?? new Map();
  }
}

/** The current value of one setting, or its default. */
export async function getSetting(name: SettingName): Promise<number> {
  const { key, default: fallback } = SETTINGS[name];
  const values = await load();
  const value = values.get(key);

  // A stored non-positive limit would mean "send nothing", which is almost
  // certainly a mistake rather than an intention. Defaults win over nonsense.
  return typeof value === "number" && value > 0 ? value : fallback;
}

/** Every setting at once, for the operator view. */
export async function getAllSettings(): Promise<{ name: SettingName; value: number; isDefault: boolean }[]> {
  const values = await load();

  return (Object.keys(SETTINGS) as SettingName[]).map((name) => {
    const { key, default: fallback } = SETTINGS[name];
    const stored = values.get(key);
    const overridden = typeof stored === "number" && stored > 0;

    return { name, value: overridden ? stored : fallback, isDefault: !overridden };
  });
}

/**
 * Drops the cache.
 *
 * For whoever changes a row by hand — the change is meant to take effect now,
 * and a minute of staleness during an incident is a minute too long.
 */
export function forgetSettings(): void {
  cache = null;
}
