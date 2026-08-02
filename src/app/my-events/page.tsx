import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@stackmyth/button";
import { PlusIcon } from "@stackmyth/icons";
import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { CreatedToast } from "@/components/created-toast";
import { Notice } from "@/components/notice";
import { ROUTES, signInPath } from "@/config/routes";
import { loadEventTypes } from "@/lib/catalog";
import { shortEventTime } from "@/lib/event-time";
import { formatEventDateTime, formatMoney } from "@/lib/format";
import { paletteIndexFor } from "@/lib/palette";
import { renderShareMessage } from "@/lib/share-message";
import { getOrganizer } from "@/lib/organizer";
import { loadShareTemplate, resolvePreferences } from "@/lib/preferences";
import { loadMyEvents } from "@/lib/roster";
import { managePath, origin, participantPath, whatsAppShareUrl } from "@/lib/urls";

import { EventList, type EventListItem } from "./event-list";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await resolvePreferences();

  return {
    title: copy.auth.myEventsTitle,
    robots: { index: false, follow: false },
  };
}

export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.myEvents));

  const { copy, locale, theme } = await resolvePreferences();

  /*
    Everything on this person's plate, not just what they made.

    Was `loadOrganizerEvents`, which answered "what did I create" — a question
    nobody opens this page with once they can also be invited to things. The
    replacement sorts as an agenda rather than a history: soonest first among
    what is coming, most recent first among what is done.
  */
  const events = await loadMyEvents(organizer.id, organizer.email);

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
  const shareTemplate = await loadShareTemplate(organizer.id, copy.share.defaultMessage);

  // One lookup for the whole list: the catalogue is a handful of rows, and the
  // alternative is a join repeating the same labels on every event.
  const typeLabels = new Map(
    (await loadEventTypes(locale)).map((type) => [type.id, type.label] as const),
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
    <>
      <AppHeader organizer={organizer} theme={theme} />

      <Container size="1" px="4" py="6">
        <Stack gap="5">
          {/* Creation redirects here for account holders, so the confirmation
              arrives as a flag on the URL rather than with the action. */}
          {created === "1" ? <CreatedToast /> : null}

          {/*
            No breadcrumb here, and that is the trail being honest rather than
            an omission. This screen is the root of the signed-in app — `/`
            redirects to it — so the only crumb available is the page itself,
            and a one-item trail just restates the heading below it. A "Home"
            crumb above it would link to `/`, which bounces straight back here.
          */}
          <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
            {copy.auth.myEventsHeading}
          </Text>

          {/*
            The primary action sits above the list rather than under it. It used
            to be the last thing on the page, which meant an organizer with a
            dozen events scrolled past all of them to create the thirteenth.
          */}
          <Button asChild size="lg" fullWidth>
            <Link href={ROUTES.newEvent}>
              {/*
                A Flex here, unlike a plain Button. Button normally wraps its
                children in `.sm-button__content`, which supplies the 8px gap —
                but `asChild` clones the Link and that wrapper is never
                rendered, so without this the icon and the label touch.
                Verified in the DOM, not assumed.
              */}
              <Flex gap="2" align="center" justify="center">
                <PlusIcon size={16} aria-hidden="true" />
                {copy.home.cta}
              </Flex>
            </Link>
          </Button>

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
      </Container>
    </>
  );
}
