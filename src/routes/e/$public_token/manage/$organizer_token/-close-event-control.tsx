"use client";

import { useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";

import { useRouter } from "@tanstack/react-router";

import { setEventClosedFn } from "./-fns";

export function CloseEventControl({
  publicToken,
  organizerToken,
  isClosed,
}: {
  publicToken: string;
  organizerToken: string;
  isClosed: boolean;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setEventClosedFn({ data: { publicToken, organizerToken, closed: !isClosed } });
      await router.invalidate();
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
