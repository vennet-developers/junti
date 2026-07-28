import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { EmptyState } from "@stackmyth/empty-state";
import { CalendarIcon } from "@stackmyth/icons";
import { Box, Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { List, ListItem } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import { OrganizerBadge } from "@/components/organizer-badge";
import { copy } from "@/config/copy";
import { formatEventDateTime } from "@/lib/format";
import { getOrganizer } from "@/lib/organizer";
import { loadOrganizerEvents } from "@/lib/roster";
import { managePath } from "@/lib/urls";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: copy.auth.myEventsTitle,
  robots: { index: false, follow: false },
};

const SHORT_DATE = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Bogota",
});

export default async function MyEventsPage() {
  const organizer = await getOrganizer();
  if (!organizer) redirect("/entrar?next=%2Fmis-eventos");

  // Newest first — see loadOrganizerEvents.
  const events = await loadOrganizerEvents(organizer.id);

  return (
    <Container size="1">
      <Stack gap="6" py="6" px="4">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <OrganizerBadge organizer={organizer} />
          <SignOutButton />
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
                <Link href="/new">{copy.home.cta}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <List as="ul" divided>
              {events.map((event) => (
                <ListItem key={event.id}>
                  <Stack gap="2" width="100%">
                    <Flex justify="between" align="start" gap="3">
                      <Box minWidth="0">
                        <Stack gap="1">
                          <Text weight="semibold">{event.title}</Text>
                          <Text variant="small" color="muted">
                            {formatEventDateTime(event.startsAt)}
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

                    <Flex justify="between" align="center" gap="3" wrap="wrap">
                      <Text variant="small" color="muted">
                        {copy.auth.attendingCount(event.attendingCount)} ·{" "}
                        {copy.auth.createdOn(SHORT_DATE.format(event.createdAt))}
                      </Text>
                      <Button asChild size="md" variant="secondary">
                        <Link href={managePath(event.publicToken, event.organizerToken)}>
                          {copy.auth.manage}
                        </Link>
                      </Button>
                    </Flex>
                  </Stack>
                </ListItem>
              ))}
            </List>

            <Button asChild size="lg" fullWidth>
              <Link href="/new">{copy.home.cta}</Link>
            </Button>
          </>
        )}
      </Stack>
    </Container>
  );
}
