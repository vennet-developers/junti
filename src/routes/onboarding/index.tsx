import { Center, Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, signInPath } from "@/config/routes";

import { OnboardingForm } from "./-onboarding-form";

/**
 * First run, for an account nobody told us anything about.
 *
 * **Not a wall everybody hits.** The auth callback sends people here only when
 * the identity provider supplied no name, which in practice means an emailed
 * link and never a Google account. Somebody who has already completed it is
 * bounced straight out, so a stale bookmark or a second tab cannot make anyone
 * fill this in twice.
 *
 * No breadcrumb. Every other page has one because it belongs somewhere in the
 * product; this one is a step in the middle of arriving, and offering a way to
 * wander off mid-flow would leave an account half-made.
 */
const gate = createServerFn({ method: "GET" })
  .validator((data: { next?: string }) => data)
  .handler(async ({ data }) => {
    const [{ getOrganizer }, { loadProfile }, { getViewerCopy }] = await Promise.all([
      import("@/lib/organizer"),
      import("@/lib/profile"),
      import("@/lib/locale"),
    ]);

    const organizer = await getOrganizer();
    if (!organizer) throw redirect({ to: signInPath(ROUTES.onboarding) as never });

    const destination =
      data.next?.startsWith("/") && !data.next.startsWith("//") ? data.next : ROUTES.myEvents;

    // Already done. Nothing to ask, so do not ask.
    const existing = await loadProfile(organizer.id);
    if (existing) throw redirect({ to: destination as never });

    const { copy } = await getViewerCopy();

    return { title: copy.onboarding.title, destination, defaultName: organizer.displayName };
  });

export const Route = createFileRoute("/onboarding/")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  loaderDeps: ({ search }) => ({ next: search.next }),
  loader: ({ deps }) => gate({ data: { next: deps.next } }),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { copy } = useCopy();
  const { destination, defaultName } = Route.useLoaderData();

  return (
    /*
      Narrow, and centred once the screen is tall enough to make that a
      question. A short card pinned to the top of a 900px viewport with
      everything under it empty reads as a page that stopped loading — and this
      is a gate somebody has been sent to, so looking broken is expensive.

      `minHeight` only from `md`: on a phone the content already fills what it
      needs and forcing a viewport fraction there would only add scroll.
    */
    <Center minHeight={{ base: "auto", md: "62dvh" }}>
      <Container size="1" px="4" py="7">
        <Stack gap="6">
          <Stack gap="2">
            <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
              {copy.onboarding.heading}
            </Text>
            <Text color="muted">{copy.onboarding.subheading}</Text>
          </Stack>

          {/*
            The email's local part is a decent first guess and a terrible final
            answer — "ivelaval" is not what anybody's friends call them. Offered
            as a starting point they can overwrite rather than left blank,
            because an empty required field on arrival reads as a chore.
          */}
          <OnboardingForm next={destination} defaultName={defaultName} />
        </Stack>
      </Container>
    </Center>
  );
}
