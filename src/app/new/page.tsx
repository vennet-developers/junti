import type { Metadata } from "next";
import Link from "next/link";

import { Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { LanguageSwitcher } from "@/components/language-switcher";
import { getViewerCopy } from "@/lib/locale";
import { detectTimeZone } from "@/lib/time-zones";

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

        {/* The server cannot know the organizer's zone — it only ever sees
            UTC on Vercel — so the form detects it in the browser and this is
            just the floor if that fails. */}
        <CreateEventForm defaultTimeZone={detectTimeZone()} defaultLocale={locale} />
      </Stack>
    </Container>
  );
}
