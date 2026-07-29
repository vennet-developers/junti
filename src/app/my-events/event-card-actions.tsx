"use client";

import { useTransition } from "react";

import Link from "next/link";

import { Button } from "@stackmyth/button";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { ROUTES } from "@/config/routes";

import { duplicateEvent } from "./actions";

/**
 * What you can do with one of your events without opening it.
 *
 * The two duplicate buttons are deliberate and do different jobs:
 *
 * - **Duplicate** creates it there and then, same time next week. For the
 *   fixture that never changes — five-a-side every Thursday — where opening a
 *   form to confirm what you already know is the friction.
 * - **Duplicate and edit** opens the form already describing next week, for the
 *   week the pitch moved or the price went up.
 *
 * Share sits first because account holders now land here straight after
 * creating, and sharing is what they came to do.
 */
export function EventCardActions({
  eventId,
  managePath,
  whatsAppUrl,
}: {
  eventId: string;
  managePath: string;
  whatsAppUrl: string;
}) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateEvent(eventId);

      // Both outcomes float. The card is one of a list and the message used to
      // appear underneath it, which pushed every card below it down — a layout
      // shift to say something that stops being true in four seconds.
      if (result.error) toast.error(result.error);
      else toast.success(copy.auth.duplicatedNotice);
    });
  }

  return (
    <Stack gap="2">
      <Flex gap="2" wrap="wrap">
        <Button asChild size="md" variant="primary">
          {/* Box(as="a") so `asChild` clones a Stackmyth primitive. */}
          <Box as="a" href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
            {copy.auth.share}
          </Box>
        </Button>

        {/* next/link for internal routes — a bare anchor is a full page load
            and an ESLint error in Next. Box(as="a") above is for WhatsApp,
            which is genuinely external. */}
        <Button asChild size="md" variant="secondary">
          <Link href={managePath}>{copy.auth.manage}</Link>
        </Button>
      </Flex>

      <Flex gap="2" wrap="wrap">
        <Button type="button" size="md" variant="outline" disabled={pending} onClick={duplicate}>
          {pending ? copy.auth.duplicating : copy.auth.duplicate}
        </Button>

        <Button asChild size="md" variant="ghost">
          <Link href={`${ROUTES.newEvent}?from=${eventId}`}>{copy.auth.duplicateAndEdit}</Link>
        </Button>
      </Flex>
    </Stack>
  );
}
