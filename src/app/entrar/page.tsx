import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { copy } from "@/config/copy";
import { getCurrentUser } from "@/lib/supabase/server";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: copy.auth.signInTitle,
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Only relative paths, so `?next=https://evil.example` cannot turn the
  // sign-in flow into an open redirect.
  const redirectTo = next?.startsWith("/") && !next.startsWith("//") ? next : "/mis-eventos";

  if (await getCurrentUser()) redirect(redirectTo);

  return (
    <Container size="1">
      <Stack gap="6" py="7" px="4">
        <Stack gap="2">
          <Text as="h1" variant="h2">
            {copy.auth.signInHeading}
          </Text>
          <Text color="muted">{copy.auth.signInSubheading}</Text>
        </Stack>

        <SignInForm redirectTo={redirectTo} />
      </Stack>
    </Container>
  );
}
