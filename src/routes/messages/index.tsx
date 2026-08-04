import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, signInPath } from "@/config/routes";

import { MessageForm } from "./-message-form";

/**
 * What the organizer's guests receive.
 *
 * A second settings screen beside `/profile`, and the line between them is who
 * the setting is for: `/profile` decides how this person sees the app —
 * language, timezone — while everything here leaves the building. That is the
 * WhatsApp invitation the organizer pastes into a chat, and the emailed
 * invitation now sent from the manage screen. When something else goes out, it
 * belongs on this page rather than in a fourth place.
 *
 * Signed-in only, because the message is stored against an account.
 */
const getPage = createServerFn({ method: "GET" }).handler(async () => {
  const [
    { shortEventTime },
    { getOrganizer },
    { loadStoredPreferences, resolvePreferences },
    { loadOrganizerEvents },
    { origin, participantPath },
  ] = await Promise.all([
    import("@/lib/event-time"),
    import("@/lib/organizer"),
    import("@/lib/preferences"),
    import("@/lib/roster"),
    import("@/lib/urls"),
  ]);

  const organizer = await getOrganizer();
  if (!organizer) throw redirect({ to: signInPath(ROUTES.messages) as never });

  const { copy } = await resolvePreferences();
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

  return {
    title: copy.messages.title,
    stored: stored.shareMessage,
    fallback: copy.share.defaultMessage,
    sample,
  };
});

export const Route = createFileRoute("/messages/")({
  loader: () => getPage(),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { copy } = useCopy();
  const { stored, fallback, sample } = Route.useLoaderData();

  return (
    <Container size="3" px="4" py="6">
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

        <MessageForm stored={stored} fallback={fallback} sample={sample} />
      </Stack>
    </Container>
  );
}
