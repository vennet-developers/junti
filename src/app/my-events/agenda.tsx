import Link from "next/link";

import { Box, Stack } from "@stackmyth/layout";
import { AutoSkeleton } from "@stackmyth/skeleton/auto";
import { Text } from "@stackmyth/text";

import { Notice } from "@/components/notice";
import { loadAllEventTypes } from "@/lib/catalog";
import { shortEventTime } from "@/lib/event-time";
import { formatEventDateTime, formatMoney } from "@/lib/format";
import { paletteIndexFor } from "@/lib/palette";
import { renderShareMessage } from "@/lib/share-message";
import { loadShareTemplate, resolvePreferences } from "@/lib/preferences";
import { loadMyEvents } from "@/lib/roster";
import { managePath, origin, participantPath, whatsAppShareUrl } from "@/lib/urls";

import { EventList, type EventListItem } from "./event-list";
import { AGENDA_SKELETON_NAME } from "./agenda-fallback";

/**
 * The slow half of the agenda page: everything that waits on the database.
 *
 * Split out of `page.tsx` so the page can render its shell — header, heading,
 * create button — the moment auth resolves, and stream this in behind an
 * explicit `<Suspense>`. Before the split the whole page waited on the slowest
 * query; the visitor stared at `loading.tsx` until every event, label and
 * template had loaded, then got everything at once.
 *
 * **The `AutoSkeleton` wrapper is the capture side of that boundary.** It never
 * shows a skeleton here — `loading={false}` always — its job is to trace the
 * rendered agenda after paint so the *fallback* (`agenda-fallback.tsx`, the
 * other half of the pair, same name) can replay those exact rectangles on the
 * next navigation. The reason the pair works where `loading.tsx` could not is
 * hydration: a Suspense fallback inside the page is mounted by client React on
 * a soft navigation, while a route-level `loading.tsx` is streamed HTML that
 * never hydrates. That distinction cost an afternoon to find; it is written on
 * `AutoSkeleton` itself now.
 *
 * Takes the organizer's id and email rather than re-resolving the session:
 * `page.tsx` already redirected if there is nobody, and doing auth twice per
 * request to save two props is the wrong trade.
 */
export async function Agenda({
  organizerId,
  organizerEmail,
}: {
  organizerId: string;
  /** Nullable because the session's email is — `loadMyEvents` handles both. */
  organizerEmail: string | null;
}) {
  const { copy, locale } = await resolvePreferences();

  /*
    Everything on this person's plate, not just what they made.

    Was `loadOrganizerEvents`, which answered "what did I create" — a question
    nobody opens this page with once they can also be invited to things. The
    replacement sorts as an agenda rather than a history: soonest first among
    what is coming, most recent first among what is done.
  */
  const events = await loadMyEvents(organizerId, organizerEmail);

  /*
    Asked and unanswered, lifted out of the list and pinned above it.

    It is the only state on this page that wants something from the reader; the
    rest is a record of decisions already made. Left inline it reads as one more
    row among events that need nothing.
  */
  const pending = events.filter((event) => event.role === "invited" && !event.isPast);

  // Absolute, because the share message is pasted into WhatsApp.
  const base = await origin();

  // One lookup for every card: the organizer's own invitation, or the app's.
  const shareTemplate = await loadShareTemplate(organizerId, copy.share.defaultMessage);

  // One lookup for the whole list: the catalogue is a handful of rows, and the
  // alternative is a join repeating the same labels on every event. Retired
  // kinds included — this labels events that exist, it is not a picker.
  const typeLabels = new Map(
    (await loadAllEventTypes(locale)).map((type) => [type.id, type.label] as const),
  );

  /*
    Everything the client needs, already formatted — dates in particular. Each
    event renders in its own zone and in the reader's language, both of which
    the server knows; sending Date objects instead would ship `Intl` formatting
    and the timezone list to the browser to arrive at the same strings.
  */
  const items: EventListItem[] = events.map((event) => ({
    role: event.role,
    /*
      `managePath` only exists for events this person owns, and the narrowing
      is what produces it: `organizerToken` is absent from every other variant
      of `MyEvent`, so this cannot be written any other way. See the union in
      roster.ts for why that is deliberate.
    */
    managePath:
      event.role === "organizer" ? managePath(event.publicToken, event.organizerToken) : null,
    eventPath: participantPath(event.publicToken),
    id: event.id,
    title: event.title,
    when: formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale),
    startsAtMs: event.startsAt.getTime(),
    isPast: event.isPast,
    location: event.location,
    typeLabel: typeLabels.get(event.eventTypeId) ?? null,
    /*
      Formatted here for the same reason the dates are: the currency and the
      reader's language both live on the server, and sending minor units plus a
      currency code would ship `Intl.NumberFormat` to the browser to arrive at
      this exact string. A free event says so rather than showing nothing —
      "no price" and "price not loaded" look identical on a card.
    */
    cost:
      event.costMode === "none" || event.costAmountMinor === null
        ? copy.money.free
        : formatMoney(event.costAmountMinor, event.currency, copy.intlLocale),
    /** True only when that amount is per head, which the card says out loud. */
    costPerPerson: event.costMode === "per_person",
    isClosed: event.isClosed,
    colorIndex: paletteIndexFor(event.eventTypeId),
    attendingCount: event.attendingCount,
    firstAttendees: event.firstAttendees,
    whatsAppUrl: whatsAppShareUrl(
      renderShareMessage(shareTemplate, {
        title: event.title,
        when: shortEventTime(event.startsAt, event.timeZone, copy),
        link: `${base}${participantPath(event.publicToken)}`,
      }),
    ),
  }));

  return (
    <AutoSkeleton name={AGENDA_SKELETON_NAME} loading={false}>
      <Stack gap="5">
        {/*
          Above the list and above the search, because it is the only thing
          here that is waiting on the reader. Names the events rather than
          just counting them: "you were invited to 2 events" without saying
          which ones sends somebody hunting through a list to find what this
          notice already knew.
        */}
        {pending.length > 0 ? (
          <Notice tone="info" title={copy.auth.pendingTitle(pending.length)}>
            <Stack gap="2" pt="2">
              <Text variant="small" color="muted">
                {copy.auth.pendingHelp}
              </Text>
              {pending.map((event) => (
                <Box key={event.id} as={Link} href={participantPath(event.publicToken)}>
                  <Text variant="small" weight="semibold">
                    {event.title}
                  </Text>
                </Box>
              ))}
            </Stack>
          </Notice>
        ) : null}

        <EventList events={items} />
      </Stack>
    </AutoSkeleton>
  );
}
