import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { SignInForm } from "@/components/sign-in-form";
import { ROUTES } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
import { resolvePreferences } from "@/lib/preferences";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.auth.signInTitle,
    robots: { index: false, follow: false },
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only relative paths, so `?next=https://evil.example` cannot turn the
  // sign-in flow into an open redirect.
  const redirectTo = next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.myEvents;

  if (await getCurrentUser()) redirect(redirectTo);

  const { copy } = await getViewerCopy();
  const { theme } = await resolvePreferences();

  return (
    <>
      {/* Signed out by definition — the redirect above catches anyone who is
          not. The guest control still earns its place here for the language
          and appearance it carries. */}
      <AppHeader organizer={null} theme={theme} />

      <Container size="1" px="4" py="7">
        <Stack gap="6">
          <PageBreadcrumb
            label={copy.nav.breadcrumbLabel}
            items={[{ label: copy.nav.home, href: ROUTES.home }, { label: copy.auth.signInTitle }]}
          />

          <Stack gap="2">
            <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
              {copy.auth.signInHeading}
            </Text>
            <Text color="muted">{copy.auth.signInSubheading}</Text>
          </Stack>

          <SignInForm redirectTo={redirectTo} />
        </Stack>
      </Container>
    </>
  );
}
