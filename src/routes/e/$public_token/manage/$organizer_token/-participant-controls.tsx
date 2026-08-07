"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@stackmyth/dialog";
import { Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import type { PaymentStatus } from "@/domain/types";

import { useRouter } from "@tanstack/react-router";

import { promoteParticipantFn, removeParticipantFn, setPaymentStatusFn } from "./-fns";

/**
 * Per-participant organizer controls.
 *
 * These call their server actions directly with bound arguments rather than
 * submitting a form. There is nothing to type here — each control carries a
 * fixed participant id and a fixed target status — so a `<form>` plus hidden
 * inputs would only be a way to smuggle values the caller already knows.
 * The actions validate those arguments server-side regardless, because a bound
 * argument is still client-supplied data.
 *
 * Every button here follows the same contract: the PRESSED button spins (its
 * neighbours only lock), and the tap ends in a toast saying what happened —
 * success or the server's error. A tap that visibly does nothing until the
 * list rearranges itself a second later reads as a tap that failed, and the
 * second press it invites is how double mutations happen.
 */

interface Ctx {
  publicToken: string;
  organizerToken: string;
  participantId: string;
  displayName: string;
}

/** Cycles a participant's payment between pending, confirmed and waived. */
export function PaymentControls({
  publicToken,
  organizerToken,
  participantId,
  status,
}: Ctx & { status: PaymentStatus }) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Which of the two buttons is doing the waiting. `pending` alone locks
  // both; the spinner belongs only on the one that was pressed.
  const [inFlight, setInFlight] = useState<PaymentStatus | null>(null);

  function set(next: PaymentStatus) {
    setInFlight(next);
    startTransition(async () => {
      const result = await setPaymentStatusFn({
        data: { publicToken, organizerToken, participantId, status: next },
      });

      if (result.errors._form) {
        toast.error(result.errors._form);
      } else {
        await router.invalidate();
        toast.success(
          next === "confirmed"
            ? copy.manage.toastPaid
            : next === "waived"
              ? copy.manage.toastWaived
              : copy.manage.toastPending,
        );
      }
      setInFlight(null);
    });
  }

  const toggleTarget: PaymentStatus = status === "confirmed" ? "pending" : "confirmed";

  /*
    One filled button per row, the rest as ink.

    Every control here used to carry a background, so a roster of twelve people
    was thirty-six coloured rectangles and the eye had nothing to land on. The
    act the organizer actually repeats — marking somebody paid — keeps its fill
    and everything else steps back to text. Same controls, same single tap; only
    the weight changed.
  */
  return (
    <Flex gap="1" align="center" wrap="wrap" justify="end">
      <Button
        type="button"
        size="sm"
        variant={status === "confirmed" ? "ghost" : "success"}
        soft={status !== "confirmed"}
        disabled={pending}
        loading={inFlight === toggleTarget}
        onClick={() => set(toggleTarget)}
      >
        {status === "confirmed" ? copy.manage.markPending : copy.manage.markPaid}
      </Button>

      {status !== "waived" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          loading={inFlight === "waived"}
          onClick={() => set("waived")}
        >
          {copy.manage.markWaived}
        </Button>
      ) : null}
    </Flex>
  );
}

/** Promotes somebody off the waitlist. Never automatic — this is the explicit act. */
export function PromoteControl({ publicToken, organizerToken, participantId }: Ctx) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function promote() {
    startTransition(async () => {
      const result = await promoteParticipantFn({
        data: { publicToken, organizerToken, participantId },
      });

      if (result.errors._form) {
        toast.error(result.errors._form);
      } else {
        await router.invalidate();
        toast.success(copy.manage.toastPromoted);
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="primary"
      soft
      disabled={pending}
      loading={pending}
      onClick={promote}
    >
      {copy.manage.promote}
    </Button>
  );
}

/** Marks a participant as removed, behind a confirmation. A state, not a deletion. */
export function RemoveControl({ publicToken, organizerToken, participantId, displayName }: Ctx) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function remove() {
    startTransition(async () => {
      const result = await removeParticipantFn({
        data: { publicToken, organizerToken, participantId },
      });

      if (result.errors._form) {
        toast.error(result.errors._form);
      } else {
        await router.invalidate();
        toast.success(copy.manage.toastRemoved(displayName));
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Ghost like its neighbours, but the ink stays destructive — see
          `.junti-accion-peligro`. Without it "Quitar" and "No le cobro" look
          identical, and only one of them takes a person off the list. */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="junti-accion-peligro"
        onClick={() => setOpen(true)}
        aria-label={`${copy.manage.removeParticipant} ${displayName}`}
      >
        {copy.manage.removeParticipant}
      </Button>

      <DialogContent size="sm" placement="center">
        <DialogHeader>
          <DialogTitle>{copy.manage.removeConfirmTitle}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text>{copy.manage.removeConfirmBody(displayName)}</Text>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              {copy.common.cancel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            loading={pending}
            onClick={remove}
          >
            {copy.manage.removeConfirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
