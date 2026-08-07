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

/**
 * Closing and reopening the convocation.
 *
 * Behind a confirmation, like cancelling — not because it is irreversible
 * (it is not) but because it silences a whole roster at once, and Ivan asked
 * for the pause. The dialog is also what fixed the double-press: the old
 * bare button disabled itself during the flight but LOOKED identical, so a
 * press with no visible echo invited four more. Now the button in the dialog
 * says "Cerrando…" while it works, and a toast confirms the flip.
 */
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setEventClosedFn({
        data: { publicToken, organizerToken, closed: !isClosed },
      });
      setOpen(false);

      if (result.errors._form) {
        toast.error(result.errors._form);
        return;
      }

      toast.success(isClosed ? copy.manage.reopenedDone : copy.manage.closedDone);
      await router.invalidate();
    });
  }

  return (
    <Stack gap="2">
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            type="button"
            variant={isClosed ? "primary" : "outline"}
            size="md"
            fullWidth
          >
            {isClosed ? copy.manage.reopenEvent : copy.manage.closeEvent}
          </Button>
        }
        title={isClosed ? copy.manage.reopenConfirmTitle : copy.manage.closeConfirmTitle}
        description={isClosed ? copy.manage.reopenConfirmBody : copy.manage.closeConfirmBody}
        confirm={
          <Button type="button" size="md" variant="primary" loading={pending}>
            {pending
              ? isClosed
                ? copy.manage.reopening
                : copy.manage.closing
              : isClosed
                ? copy.manage.reopenEvent
                : copy.manage.closeEvent}
          </Button>
        }
        cancel={
          <Button type="button" size="md" variant="secondary">
            {copy.common.cancel}
          </Button>
        }
        pending={pending}
        onConfirm={toggle}
      />
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
        /*
          Red and full width, at the very end of the column — Ivan's call.
          Both signals say the same thing from different distances: the color
          names the severity before you read a word, and matching the close
          button's width keeps the column reading as one set of controls
          instead of a footnote hiding under it. The real guard is still the
          dialog; the styling only makes sure nobody meets it surprised.
        */
        <Button type="button" size="md" variant="destructive" fullWidth>
          {copy.manage.cancel}
        </Button>
      }
      title={copy.manage.cancelConfirm(title)}
      description={copy.manage.cancelConfirmBody}
      confirm={
        <Button type="button" size="md" variant="destructive" loading={pending}>
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
