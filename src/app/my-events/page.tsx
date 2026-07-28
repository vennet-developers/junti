import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { EmptyState } from "@stackmyth/empty-state";
import { CalendarIcon } from "@stackmyth/icons";
import { Box, Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { LanguageSwitcher } from "@/components/language-switcher";
import { OrganizerBadge } from "@/components/organizer-badge";
import { shortEventTime } from "@/lib/event-time";
import { formatDate, formatEventDateTime } from "@/lib/format";
import { ROUTES, signInPath } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { loadOrganizerEvents } from "@/lib/roster";
import { managePath, origin, participantPath, whatsAppShareUrl } from "@/lib/urls";

import { EventCardActions } from "./event-card-actions";
import { SignOutButton } from "./sign-out-button";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.auth.myEventsTitle,
    robots: { index: false, follow: false },
  };
}

export default async function MyEventsPage() {
  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.myEvents));

  const { copy } = await getViewerCopy();

  // Newest first — see loadOrganizerEvents.
  const events = await loadOrganizerEvents(organizer.id);

  // Absolute, because the share message is pasted into WhatsApp.
  const base = await origin();

  return (
    <Container size="1">
      <Stack gap="6" py="6" px="4">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <OrganizerBadge organizer={organizer} />
          <Flex gap="2" align="center">
            <Text variant="small" color="muted">
              <Link href={ROUTES.profile}>{copy.profile.link}</Link>
            </Text>
            <LanguageSwitcher />
            <SignOutButton />
          </Flex>
        </Flex>

        <Divider />

        <Flex justify="between" align="baseline" gap="2">
          <Text as="h1" variant="h2">
            {copy.auth.myEventsHeading}
          </Text>
          <Text variant="small" color="muted">
            {events.length}
          </Text>
        </Flex>

        {events.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon size={28} />}
            title={copy.auth.myEventsEmpty}
            description={copy.auth.myEventsEmptyHelp}
            action={
              <Button asChild size="md">
                <Link href={ROUTES.newEvent}>{copy.home.cta}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Stack gap="3">
              {events.map((event) => (
                <Card surface="outlined" key={event.id}>
                  <CardContent>
                    <Stack gap="3">
                      <Flex justify="between" align="start" gap="3">
                        <Box minWidth="0">
                          <Stack gap="1">
                            <Text weight="semibold">{event.title}</Text>
                            <Text variant="small" color="muted">
                              {formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale)}
                            </Text>
                          </Stack>
                        </Box>
                        <Box flexShrink={0}>
                          {event.isClosed ? (
                            <Badge variant="error" size="sm" soft>
                              {copy.event.closedBadge}
                            </Badge>
                          ) : null}
                        </Box>
                      </Flex>

                      <Text variant="small" color="muted">
                        {copy.auth.attendingCount(event.attendingCount)} ·{" "}
                        {copy.auth.createdOn(
                          formatDate(event.createdAt, event.timeZone, copy.intlLocale),
                        )}
                      </Text>

                      <EventCardActions
                        eventId={event.id}
                        managePath={managePath(event.publicToken, event.organizerToken)}
                        whatsAppUrl={whatsAppShareUrl(
                          copy.share.whatsAppMessage(
                            event.title,
                            shortEventTime(event.startsAt, event.timeZone, copy),
                            `${base}${participantPath(event.publicToken)}`,
                          ),
                        )}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            <Button asChild size="lg" fullWidth>
              <Link href={ROUTES.newEvent}>{copy.home.cta}</Link>
            </Button>
          </>
        )}
      </Stack>
    </Container>
  );
}
