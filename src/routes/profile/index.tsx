import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, signInPath } from "@/config/routes";

import { CreditsPanel } from "./-credits-panel";
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

  /*
    Both sides of the standing credit, on the one screen that belongs to a
    person rather than to an event. Owed-to-you is the reassurance; owed-by-
    you is the half that actually gets debts settled, because an organizer
    who sees "le debes a 10 personas" in one place acts on it and one who has
    it scattered across old events does not.

    Names are resolved for the counterpart so the list reads as people rather
    than as ids.
  */
  const { loadCreditsOwedTo, loadCreditsOwedBy } = await import("@/lib/credits");
  const [owedToYou, owedByYou] = await Promise.all([
    loadCreditsOwedTo(organizer.id),
    loadCreditsOwedBy(organizer.id),
  ]);

  const { loadDisplayNames } = await import("@/lib/accounts");
  const names = await loadDisplayNames([
    ...owedToYou.map((credit) => credit.counterpartId),
    ...owedByYou.map((credit) => credit.counterpartId),
  ]);

  const withNames = (list: typeof owedToYou) =>
    list.map((credit) => ({
      id: credit.id,
      availableMinor: credit.availableMinor,
      currency: credit.currency,
      counterpartName: names.get(credit.counterpartId) ?? "",
      originEventTitle: credit.originEventTitle,
    }));

  return {
    title: copy.profile.title,
    owedToYou: withNames(owedToYou),
    owedByYou: withNames(owedByYou),
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
  const { initialLocale, initialTimeZone, initialCurrency, owedToYou, owedByYou } =
    Route.useLoaderData();

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

        {/* Below the preferences, because money between people outlives a
            language setting and deserves its own card rather than a row in
            somebody else's form. Renders nothing when there is nothing owed
            in either direction. */}
        <CreditsPanel owedToYou={owedToYou} owedByYou={owedByYou} />
      </Stack>
    </Container>
  );
}
