import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Center, Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { ROUTES, signInPath } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { loadProfile } from "@/lib/profile";

import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.onboarding.title,
    robots: { index: false, follow: false },
  };
}

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
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.onboarding));

  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.myEvents;

  // Already done. Nothing to ask, so do not ask.
  const existing = await loadProfile(organizer.id);
  if (existing) redirect(destination);

  const { copy } = await getViewerCopy();

  return (
    <>
      {/*
        Narrow, and centred once the screen is tall enough to make that a
        question. A short card pinned to the top of a 900px viewport with
        everything under it empty reads as a page that stopped loading — and this
        is a gate somebody has been sent to, so looking broken is expensive.

        `minHeight` only from `md`: on a phone the content already fills what it
        needs and forcing a viewport fraction there would only add scroll.
      */}
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
            <OnboardingForm next={destination} defaultName={organizer.displayName} />
          </Stack>
        </Container>
      </Center>
    </>
  );
}
