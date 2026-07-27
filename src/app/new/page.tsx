import type { Metadata } from "next";
import Link from "next/link";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { copy } from "@/config/copy";

import { CreateEventForm } from "./create-event-form";

export const metadata: Metadata = {
  title: copy.createEvent.title,
  robots: { index: false, follow: false },
};

export default function NewEventPage() {
  return (
    <Container size="1">
      <Stack gap="6" py="6" px="4" wordBreak="break-word">
        <Stack gap="2">
          <Text variant="small" color="muted">
            <Link href="/">{copy.common.back}</Link>
          </Text>
          <Text variant="h1">{copy.createEvent.heading}</Text>
          <Text color="muted">{copy.createEvent.subheading}</Text>
        </Stack>

        <CreateEventForm />
      </Stack>
    </Container>
  );
}
