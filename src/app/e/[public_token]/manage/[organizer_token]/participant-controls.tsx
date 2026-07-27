"use client";

import { useActionState, useState } from "react";

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

import { copy } from "@/config/copy";
import type { PaymentStatus } from "@/domain/types";

import {
  promoteParticipant,
  removeParticipant,
  setPaymentStatus,
  type ManageState,
} from "./actions";

/** Declared here, not in actions.ts: a "use server" module exports only async functions. */
const EMPTY_STATE: ManageState = { errors: {} };

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
  const action = setPaymentStatus.bind(null, publicToken, organizerToken);
  const [, formAction, pending] = useActionState<ManageState, FormData>(action, EMPTY_STATE);

  const next: PaymentStatus = status === "confirmed" ? "pending" : "confirmed";

  return (
    <Flex gap="2" align="center" wrap="wrap" justify="end">
      <form action={formAction}>
        <input type="hidden" name="participantId" value={participantId} />
        <input type="hidden" name="status" value={next} />
        <Button
          type="submit"
          size="xs"
          variant={status === "confirmed" ? "outline" : "success"}
          soft={status !== "confirmed"}
          disabled={pending}
        >
          {status === "confirmed" ? copy.manage.markPending : copy.manage.markPaid}
        </Button>
      </form>

      {status !== "waived" ? (
        <form action={formAction}>
          <input type="hidden" name="participantId" value={participantId} />
          <input type="hidden" name="status" value="waived" />
          <Button type="submit" size="xs" variant="ghost" disabled={pending}>
            {copy.manage.markWaived}
          </Button>
        </form>
      ) : null}
    </Flex>
  );
}

/** Promotes somebody off the waitlist. Never automatic — this is the explicit act. */
export function PromoteControl({ publicToken, organizerToken, participantId }: Ctx) {
  const action = promoteParticipant.bind(null, publicToken, organizerToken);
  const [, formAction, pending] = useActionState<ManageState, FormData>(action, EMPTY_STATE);

  return (
    <form action={formAction}>
      <input type="hidden" name="participantId" value={participantId} />
      <Button type="submit" size="xs" variant="primary" soft disabled={pending}>
        {copy.manage.promote}
      </Button>
    </form>
  );
}

/** Removes a participant, behind a confirmation. */
export function RemoveControl({
  publicToken,
  organizerToken,
  participantId,
  displayName,
}: Ctx) {
  const action = removeParticipant.bind(null, publicToken, organizerToken);
  const [, formAction, pending] = useActionState<ManageState, FormData>(action, EMPTY_STATE);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="xs"
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
          <form action={formAction}>
            <input type="hidden" name="participantId" value={participantId} />
            <Button type="submit" variant="destructive" disabled={pending}>
              {copy.manage.removeConfirmAction}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
