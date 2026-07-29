import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@stackmyth/button";
import { CalendarIcon, PlusIcon } from "@stackmyth/icons";
import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { ProfileMenu } from "@/components/profile-menu";
import { ROUTES, signInPath } from "@/config/routes";
import { loadEventTypes } from "@/lib/catalog";
import { shortEventTime } from "@/lib/event-time";
import { formatEventDateTime } from "@/lib/format";
import { getOrganizer } from "@/lib/organizer";
import { resolvePreferences } from "@/lib/preferences";
import { loadOrganizerEvents } from "@/lib/roster";
import { managePath, origin, participantPath, whatsAppShareUrl } from "@/lib/urls";

import { EventList, type EventListItem } from "./event-list";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await resolvePreferences();

  return {
    title: copy.auth.myEventsTitle,
    robots: { index: false, follow: false },
  };
}

export default async function MyEventsPage() {
  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.myEvents));

  const { copy, locale, theme } = await resolvePreferences();

  // Newest first — see loadOrganizerEvents.
  const events = await loadOrganizerEvents(organizer.id);

  // Absolute, because the share message is pasted into WhatsApp.
  const base = await origin();

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
    id: event.id,
    title: event.title,
    when: formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale),
    startsAtMs: event.startsAt.getTime(),
    isPast: event.isPast,
    location: event.location,
    typeLabel: typeLabels.get(event.eventTypeId) ?? null,
    isClosed: event.isClosed,
    attendingCount: event.attendingCount,
    firstAttendees: event.firstAttendees,
    managePath: managePath(event.publicToken, event.organizerToken),
    whatsAppUrl: whatsAppShareUrl(
      copy.share.whatsAppMessage(
        event.title,
        shortEventTime(event.startsAt, event.timeZone, copy),
        `${base}${participantPath(event.publicToken)}`,
      ),
    ),
  }));

  return (
    <Container size="1" px="4" py="6">
      <Stack gap="5">
        <Flex justify="between" align="center" gap="3">
          <Flex gap="2" align="center" minWidth="0">
            <Box flexShrink={0} display="flex" color="var(--sm-text-secondary)">
              <CalendarIcon size={22} aria-hidden="true" />
            </Box>
            <Text as="h1" variant="h3">
              {copy.auth.myEventsHeading}
            </Text>
          </Flex>

          <Box flexShrink={0}>
            <ProfileMenu organizer={organizer} theme={theme} />
          </Box>
        </Flex>

        {/*
          The primary action sits above the list rather than under it. It used
          to be the last thing on the page, which meant an organizer with a
          dozen events scrolled past all of them to create the thirteenth.
        */}
        <Button asChild size="md" fullWidth>
          <Link href={ROUTES.newEvent}>
            <Flex gap="2" align="center" justify="center">
              <PlusIcon size={16} aria-hidden="true" />
              {copy.home.cta}
            </Flex>
          </Link>
        </Button>

        <EventList events={items} />
      </Stack>
    </Container>
  );
}
