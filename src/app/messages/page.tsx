import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ROUTES, signInPath } from "@/config/routes";
import { shortEventTime } from "@/lib/event-time";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { loadStoredPreferences, resolvePreferences } from "@/lib/preferences";
import { loadOrganizerEvents } from "@/lib/roster";
import { origin, participantPath } from "@/lib/urls";

import { MessageForm } from "./message-form";

/**
 * What the organizer's guests receive.
 *
 * A second settings screen beside `/profile`, and the line between them is who
 * the setting is for: `/profile` decides how this person sees the app —
 * language, timezone — while everything here leaves the building. Today that
 * is the WhatsApp invitation, which is the only message Junti sends: nobody
 * collects a participant's email, they type a name into a link. When something
 * else does go out, it belongs on this page rather than in a fourth place.
 *
 * Signed-in only, because the message is stored against an account. An
 * anonymous organizer keeps the app's default, which is why `loadShareTemplate`
 * takes a nullable owner.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.messages.title,
    robots: { index: false, follow: false },
  };
}

export default async function MessagesPage() {
  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.messages));

  const { copy, theme } = await resolvePreferences();
  const stored = await loadStoredPreferences(organizer.id);

  /*
    The preview runs on one of their own events, newest first, so the sample
    carries a real title and a real date — the two things whose length decides
    whether a message reads well. Somebody with no events yet gets the wording
    the app would use for one, which is the best that can be done without
    inventing a fixture that looks like data.
  */
  const [newest] = await loadOrganizerEvents(organizer.id);
  const base = await origin();

  const sample = newest
    ? {
        title: newest.title,
        when: shortEventTime(newest.startsAt, newest.timeZone, copy),
        link: `${base}${participantPath(newest.publicToken)}`,
      }
    : {
        title: copy.messages.sampleTitle,
        when: copy.messages.sampleWhen,
        link: `${base}${participantPath("ejemplo")}`,
      };

  return (
    <>
      <AppHeader organizer={organizer} theme={theme} />

      <Container size="1" px="4" py="6">
        <Stack gap="6">
          <PageBreadcrumb
            label={copy.nav.breadcrumbLabel}
            items={[{ label: copy.nav.home, href: ROUTES.home }, { label: copy.messages.link }]}
          />

          <Stack gap="2">
            <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
              {copy.messages.heading}
            </Text>
            <Text color="muted">{copy.messages.subheading}</Text>
          </Stack>

          <MessageForm
            stored={stored.shareMessage}
            fallback={copy.share.defaultMessage}
            sample={sample}
          />
        </Stack>
      </Container>
    </>
  );
}
