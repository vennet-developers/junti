import { Suspense } from "react";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@stackmyth/button";
import { PlusIcon } from "@stackmyth/icons";
import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { CreatedToast } from "@/components/created-toast";
import { ROUTES, signInPath } from "@/config/routes";
import { getOrganizer } from "@/lib/organizer";
import { resolvePreferences } from "@/lib/preferences";

import { Agenda } from "./agenda";
import { AgendaFallback } from "./agenda-fallback";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await resolvePreferences();

  return {
    title: copy.auth.myEventsTitle,
    robots: { index: false, follow: false },
  };
}

/**
 * The shell, streaming the agenda in behind it.
 *
 * Everything here resolves from cookies — who you are, which language, which
 * theme — so it renders in the time a session check takes. The database work
 * lives in {@link Agenda}, behind an explicit `<Suspense>`: heading and create
 * button appear at once, the list streams in when the queries land.
 *
 * An explicit boundary rather than leaning on `loading.tsx`, and the
 * difference is not cosmetic. A route-level fallback is streamed HTML that
 * React replaces without hydrating; a fallback inside the page is mounted by
 * client React on soft navigations. That is what lets `AgendaFallback` replay
 * the agenda's traced skeleton instead of a hand-drawn guess — see the pair of
 * files it points to. `loading.tsx` stays, but now only covers the auth check,
 * which is the part of the wait it can actually see.
 */
export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.myEvents));

  const { copy } = await resolvePreferences();

  return (
    <>
      {/*
        The scan tier. This screen is a list you sweep for the next thing you
        have to think about, and more of it in view is strictly better — see the
        width policy in globals.css. Costs nothing on a phone: `size` is a
        max-width, and at 390px a 880px cap and a 448px cap both simply fill the
        screen.
      */}
      <Container size="3" px="4" py="6">
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
            It also sits outside the Suspense boundary on purpose: creating an
            event does not depend on the list of existing ones, and the person
            who came here to make one should not wait on queries about the rest.
          */}
          {/*
            Full-bleed on a phone, where the thumb wants the whole width; capped
            once the page is wide, because one button stretched across 880px
            stops reading as a button and starts reading as a banner. The cap
            goes on a wrapper so `fullWidth` keeps meaning "fill your parent"
            and the two do not fight each other.
          */}
          <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
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
          </Box>

          <Suspense fallback={<AgendaFallback />}>
            <Agenda organizerId={organizer.id} organizerEmail={organizer.email} />
          </Suspense>
        </Stack>
      </Container>
    </>
  );
}
