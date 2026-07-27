"use client";

import { useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { copy } from "@/config/copy";

import { setEventClosed } from "./actions";

export function CloseEventControl({
  publicToken,
  organizerToken,
  isClosed,
}: {
  publicToken: string;
  organizerToken: string;
  isClosed: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setEventClosed(publicToken, organizerToken, !isClosed);
    });
  }

  return (
    <Stack gap="2">
      <Button
        type="button"
        variant={isClosed ? "primary" : "outline"}
        size="md"
        fullWidth
        onClick={toggle}
        disabled={pending}
      >
        {isClosed ? copy.manage.reopenEvent : copy.manage.closeEvent}
      </Button>
      <Text variant="small" color="muted">
        {copy.manage.closeEventHelp}
      </Text>
    </Stack>
  );
}
