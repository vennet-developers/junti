import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ROUTES, signInPath } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { loadStoredPreferences, resolvePreferences } from "@/lib/preferences";

import { ProfileForm } from "./profile-form";

/**
 * Where a signed-in reader sets their own language and timezone.
 *
 * Signed-in only, because these are stored against an account — that is what
 * makes them follow somebody to a new phone. Anyone signed out still gets
 * automatic detection and the language switcher, which covers the common case
 * of a participant opening a WhatsApp link.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.profile.title,
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage() {
  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.profile));

  const { copy } = await resolvePreferences();

  // The stored record, NOT the effective cookie: the form has to show what the
  // account actually chose, and "follow my browser" must render as that rather
  // than as whatever the browser happens to be right now.
  const stored = await loadStoredPreferences(organizer.id);

  return (
    <>
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

          <ProfileForm initialLocale={stored.locale} initialTimeZone={stored.timeZone} />
        </Stack>
      </Container>
    </>
  );
}
