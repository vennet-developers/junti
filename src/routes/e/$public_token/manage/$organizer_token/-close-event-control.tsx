"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { ConfirmDialog } from "@stackmyth/dialog";
import { Stack } from "@stackmyth/layout";
import { toast } from "@stackmyth/toast";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";

import { useRouter } from "@tanstack/react-router";

import { cancelEventFn, setEventClosedFn } from "./-fns";

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

/**
 * Calling the event off.
 *
 * Separate from closing, and visually quieter than it, because the two are one
 * misread away from each other and only one of them can be undone. The
 * confirmation spells out what happens rather than asking "are you sure" — the
 * thing worth knowing is that everybody gets an email and the event leaves
 * their calendar.
 */
export function CancelEventControl({
  publicToken,
  organizerToken,
  title,
}: {
  publicToken: string;
  organizerToken: string;
  title: string;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const result = await cancelEventFn({ data: { publicToken, organizerToken } });
      setOpen(false);

      if (result.errors._form) {
        toast.error(result.errors._form);
        return;
      }

      toast.success(copy.manage.cancelled);
      await router.invalidate();
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" size="sm" variant="ghost">
          {copy.manage.cancel}
        </Button>
      }
      title={copy.manage.cancelConfirm(title)}
      description={copy.manage.cancelConfirmBody}
      confirm={
        <Button type="button" size="md" variant="destructive">
          {pending ? copy.manage.cancelling : copy.manage.cancel}
        </Button>
      }
      cancel={
        <Button type="button" size="md" variant="secondary">
          {copy.common.cancel}
        </Button>
      }
      pending={pending}
      onConfirm={cancel}
    />
  );
}
