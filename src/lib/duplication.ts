import "@/server/assert-server";

import { and, eq } from "drizzle-orm";

import type { Locale } from "@/config/copy";
import { db } from "@/db/client";
import { events } from "@/db/schema";

import { nextWeekStart } from "./recurrence";
import { toDatePartValue, toMajorUnits, toTimePartValue } from "./format";
import { loadEventPolicies } from "./roster";

/**
 * An event, reshaped into the values the create form expects.
 *
 * Powers "duplicate and edit": the form opens already describing next week's
 * fixture, and the organizer changes whatever moved. Returns null when the
 * event does not exist or is not theirs — checked in the query, not after it,
 * so a guessed id finds nothing rather than leaking a title.
 */
export async function loadEventAsFormValues(
  eventId: string,
  organizerId: string,
  locale: Locale,
): Promise<Record<string, unknown> | null> {
  const [source] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .limit(1);

  if (!source) return null;

  const startsAt = nextWeekStart(source.startsAt);
  const policies = await loadEventPolicies(source.id, locale);

  return {
    title: source.title,
    eventTypeId: source.eventTypeId,
    // Split in the event's OWN zone, so a duplicate keeps its wall-clock time
    // rather than drifting by wherever the organizer happens to be today.
    startsAtDate: toDatePartValue(startsAt, source.timeZone),
    startsAtTime: toTimePartValue(startsAt, source.timeZone),
    timeZone: source.timeZone,
    locale: source.locale,
    location: source.location ?? "",
    capacity: source.capacity === null ? "" : String(source.capacity),
    notes: source.notes ?? "",
    costMode: source.costMode,
    costAmount:
      source.costAmountMinor === null
        ? ""
        : String(toMajorUnits(source.costAmountMinor, source.currency)),
    currency: source.currency,
    policies: JSON.stringify(
      policies.map((policy) => ({
        definitionId: policy.definitionId,
        label: policy.labelOverride,
        description: policy.descriptionOverride,
      })),
    ),
  };
}
