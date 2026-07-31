import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { loadEventTypes, loadPolicyOptionsByEventType } from "@/lib/catalog";
import { getViewerCopy } from "@/lib/locale";
import { ROUTES, signInPath } from "@/config/routes";
import { DEFAULT_TIME_ZONE } from "@/lib/format";
import { getOrganizer } from "@/lib/organizer";
import { loadEventAsFormValues } from "@/lib/duplication";
import { resolvePreferences } from "@/lib/preferences";

import { CreateEventForm } from "./create-event-form";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.createEvent.title,
    robots: { index: false, follow: false },
  };
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const { copy, locale } = await getViewerCopy();

  // A stored or detected zone beats the floor: somebody who set Bogotá in their
  // profile while living in Madrid should not re-pick it on every event.
  const { timeZone: preferredTimeZone, theme } = await resolvePreferences();
  const organizer = await getOrganizer();

  /*
    Creating needs an account now, so this is a door rather than an offer.

    There used to be a card at the top of the form asking whether you would
    rather sign in first, with the whole form still usable if you said no — and
    a draft parked in sessionStorage so the OAuth round trip did not cost you
    what you had typed. All of that existed to make an unattributed event
    possible. An event with no owner is what we stopped having, so the offer,
    the dismissal and the draft went with it.
  */
  if (!organizer) redirect(signInPath(ROUTES.newEvent));

  /**
   * "Duplicate and edit" arrives as `?from=<eventId>`.
   *
   * Loaded here rather than passed through the URL, so a fabricated id yields
   * nothing instead of a form pre-filled with somebody else's event —
   * ownership is part of the query, not a check after it.
   */
  const prefill = from ? await loadEventAsFormValues(from, organizer.id, locale) : null;

  const [eventTypes, policyOptionsByType] = await Promise.all([
    loadEventTypes(locale),
    loadPolicyOptionsByEventType(locale),
  ]);

  return (
    <>
      <AppHeader organizer={organizer} theme={theme} signInNext={ROUTES.newEvent} />

      <Container size="1" px="4" py="6">
        <Stack gap="6">
          <PageBreadcrumb
            label={copy.nav.breadcrumbLabel}
            items={[
              { label: copy.auth.myEventsLink, href: ROUTES.myEvents },
              { label: copy.nav.newEvent },
            ]}
          />

          <Stack gap="2">
            <Text variant="h1" fontFamily="var(--junti-display)">
              {copy.createEvent.heading}
            </Text>
            <Text color="muted">{copy.createEvent.subheading}</Text>
          </Stack>

          {/* A fixed floor, NOT a guess. The server genuinely cannot know the
              organizer's zone — asking Intl here returns the server's own,
              which is UTC on Vercel — so the form detects the real one on
              mount and this is only what the first paint shows. */}
          <CreateEventForm
            defaultTimeZone={preferredTimeZone ?? DEFAULT_TIME_ZONE}
            defaultLocale={locale}
            eventTypes={eventTypes}
            policyOptionsByType={policyOptionsByType}
            prefill={prefill}
          />
        </Stack>
      </Container>
    </>
  );
}
