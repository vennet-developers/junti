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

import { useCopy } from "@/components/copy-provider";
import type { PaymentStatus } from "@/domain/types";

import { promoteParticipant, removeParticipant, setPaymentStatus } from "./actions";

/**
 * Per-participant organizer controls.
 *
 * These call their server actions directly with bound arguments rather than
 * submitting a form. There is nothing to type here — each control carries a
 * fixed participant id and a fixed target status — so a `<form>` plus hidden
 * inputs would only be a way to smuggle values the caller already knows.
 * The actions validate those arguments server-side regardless, because a bound
 * argument is still client-supplied data.
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
  const [pending, startTransition] = useTransition();

  function set(next: PaymentStatus) {
    startTransition(async () => {
      await setPaymentStatus(publicToken, organizerToken, participantId, next);
    });
  }

  const toggleTarget: PaymentStatus = status === "confirmed" ? "pending" : "confirmed";

  return (
    <Flex gap="2" align="center" wrap="wrap" justify="end">
      <Button
        type="button"
        size="md"
        variant={status === "confirmed" ? "outline" : "success"}
        soft={status !== "confirmed"}
        disabled={pending}
        onClick={() => set(toggleTarget)}
      >
        {status === "confirmed" ? copy.manage.markPending : copy.manage.markPaid}
      </Button>

      {status !== "waived" ? (
        <Button
          type="button"
          size="md"
          variant="ghost"
          disabled={pending}
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
  const [pending, startTransition] = useTransition();

  function promote() {
    startTransition(async () => {
      await promoteParticipant(publicToken, organizerToken, participantId);
    });
  }

  return (
    <Button type="button" size="md" variant="primary" soft disabled={pending} onClick={promote}>
      {copy.manage.promote}
    </Button>
  );
}

/** Removes a participant, behind a confirmation. */
export function RemoveControl({ publicToken, organizerToken, participantId, displayName }: Ctx) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function remove() {
    startTransition(async () => {
      await removeParticipant(publicToken, organizerToken, participantId);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="md"
        variant="destructive"
        soft
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
            <Button variant="secondary">{copy.common.cancel}</Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
            {copy.manage.removeConfirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
