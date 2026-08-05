import "@/server/assert-server";

import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { analyticsEvents } from "@/db/schema";
import {
  EVENT_SOURCE,
  stripUnsafeProps,
  type AnalyticsEvent,
  type AnalyticsProps,
} from "@/domain/analytics";

/**
 * Recording an event, on the strict understanding that it does not matter.
 *
 * **Analytics must never be the reason something fails.** Everything here is
 * downstream of that: it does not throw, it is not awaited by its callers, and
 * a database that is down costs a row in a chart rather than an RSVP. This is
 * the same posture as `notify()`, arrived at for the same reason — a provider
 * having a bad minute must not undo a fact the user already established.
 *
 * The cost of that promise is that a missing event is invisible. That is the
 * right trade here and the wrong one for money, which is why nothing in this
 * file is the source of truth for anything.
 */
export function track(
  name: AnalyticsEvent,
  props: AnalyticsProps = {},
  actorId: string | null = null,
): void {
  // Deliberately not awaited. `void` rather than a floating promise so the
  // intent is visible and the linter does not have to guess.
  void record(name, props, actorId, EVENT_SOURCE[name]);
}

/**
 * The same thing, for events a browser reported.
 *
 * Separate from `track` because the source is not the one the taxonomy
 * declares — it is `"client"` by definition of how it arrived — and because
 * the caller has already had to check that the name is one a browser is
 * allowed to send. Keeping them apart means no call site can accidentally
 * record a payment as client-reported.
 */
export function trackFromClient(
  name: AnalyticsEvent,
  props: AnalyticsProps,
  actorId: string | null,
): void {
  void record(name, props, actorId, "client");
}

async function record(
  name: AnalyticsEvent,
  props: AnalyticsProps,
  actorId: string | null,
  source: "server" | "client",
): Promise<void> {
  try {
    const { props: safe, dropped } = stripUnsafeProps(props);

    if (dropped.length > 0 && process.env.NODE_ENV !== "production") {
      // Loud in development, silent in production. A dropped property is a
      // mistake to fix at the call site, and the place to notice it is while
      // writing the call — not in a log nobody reads.
      console.warn(
        `[analytics] ${name}: dropped ${dropped.join(", ")} — see ANALYTICS.md for what props may hold`,
      );
    }

    await db.insert(analyticsEvents).values({
      id: uuidv7(),
      name,
      actorId,
      source,
      props: safe,
    });
  } catch {
    // Swallowed on purpose. See the note above the module: a funnel is worth
    // less than any single thing a user is in the middle of doing.
  }
}
