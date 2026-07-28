import type { Metadata } from "next";
import Link from "next/link";

import { Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { LanguageSwitcher } from "@/components/language-switcher";
import { loadEventTypes, loadPolicyOptionsByEventType } from "@/lib/catalog";
import { getViewerCopy } from "@/lib/locale";
import { DEFAULT_TIME_ZONE } from "@/lib/format";

import { CreateEventForm } from "./create-event-form";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.createEvent.title,
    robots: { index: false, follow: false },
  };
}

export default async function NewEventPage() {
  const { copy, locale } = await getViewerCopy();

  const [eventTypes, policyOptionsByType] = await Promise.all([
    loadEventTypes(locale),
    loadPolicyOptionsByEventType(locale),
  ]);

  return (
    <Container size="1">
      <Stack gap="6" py="6" px="4">
        <Flex justify="between" align="center">
          <Text variant="small" color="muted">
            <Link href="/">{copy.common.back}</Link>
          </Text>
          <LanguageSwitcher />
        </Flex>

        <Stack gap="2">
          <Text variant="h1">{copy.createEvent.heading}</Text>
          <Text color="muted">{copy.createEvent.subheading}</Text>
        </Stack>

        {/* A fixed floor, NOT a guess. The server genuinely cannot know the
            organizer's zone — asking Intl here returns the server's own, which
            is UTC on Vercel — so the form detects the real one on mount and
            this is only what the first paint shows. */}
        <CreateEventForm
          defaultTimeZone={DEFAULT_TIME_ZONE}
          defaultLocale={locale}
          eventTypes={eventTypes}
          policyOptionsByType={policyOptionsByType}
        />
      </Stack>
    </Container>
  );
}
