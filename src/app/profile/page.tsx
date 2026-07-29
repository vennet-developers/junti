import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
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

  const { copy, theme } = await resolvePreferences();

  // The stored record, NOT the effective cookie: the form has to show what the
  // account actually chose, and "follow my browser" must render as that rather
  // than as whatever the browser happens to be right now.
  const stored = await loadStoredPreferences(organizer.id);

  return (
    <>
      <AppHeader organizer={organizer} theme={theme} />

      <Container size="1" px="4" py="6">
        <Stack gap="6">
          <Stack gap="2">
            <Text as="h1" variant="h3">
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
