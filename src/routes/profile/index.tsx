import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, signInPath } from "@/config/routes";

import { ProfileForm } from "./-profile-form";

/**
 * Where a signed-in reader sets their own language and timezone.
 *
 * Signed-in only, because these are stored against an account — that is what
 * makes them follow somebody to a new phone. Anyone signed out still gets
 * automatic detection and the language switcher, which covers the common case
 * of a participant opening a WhatsApp link.
 */
const gate = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getOrganizer }, { loadStoredPreferences }, { getViewerCopy }] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/preferences"),
    import("@/lib/locale"),
  ]);

  const organizer = await getOrganizer();
  if (!organizer) throw redirect({ to: signInPath(ROUTES.profile) as never });

  const { copy } = await getViewerCopy();

  // The stored record, NOT the effective cookie: the form has to show what the
  // account actually chose, and "follow my browser" must render as that rather
  // than as whatever the browser happens to be right now.
  const stored = await loadStoredPreferences(organizer.id);

  return {
    title: copy.profile.title,
    initialLocale: stored.locale,
    initialTimeZone: stored.timeZone,
    initialCurrency: stored.currency,
  };
});

export const Route = createFileRoute("/profile/")({
  loader: () => gate(),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { copy } = useCopy();
  const { initialLocale, initialTimeZone, initialCurrency } = Route.useLoaderData();

  return (
    <Container size="2" px="4" py="6">
      <Stack gap="6">
        {/*
          Home, not "my events". This screen is beside the events, not inside
          them: your language and your timezone are not part of any roster,
          and a trail reading "My events › My profile" claimed a containment
          that does not exist. The event screens keep "My events" as their
          root because an event genuinely is one of yours.

          The destination is the same either way — `/` redirects an account
          holder to their events — so this is about what the trail says, not
          about where the link goes. Which is the whole job of a breadcrumb.
        */}
        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[{ label: copy.nav.home, href: ROUTES.home }, { label: copy.profile.link }]}
        />

        <Stack gap="2">
          <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
            {copy.profile.heading}
          </Text>
          <Text color="muted">{copy.profile.subheading}</Text>
        </Stack>

        <ProfileForm
          initialLocale={initialLocale}
          initialTimeZone={initialTimeZone}
          initialCurrency={initialCurrency}
        />
      </Stack>
    </Container>
  );
}
