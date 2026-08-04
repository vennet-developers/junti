"use client";

import type { ReactNode } from "react";

import { Button } from "@stackmyth/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stackmyth/dialog";

import { useCopy } from "@/components/copy-provider";

/**
 * "Are you sure?", asked properly.
 *
 * This replaced `window.confirm`, which was wrong in three ways that matter:
 * it looks like the browser rather than like this app, it cannot be
 * translated — the buttons say whatever Chrome says in whatever language
 * Chrome is in — and it blocks the entire page and every timer on it until
 * somebody answers.
 *
 * `alert` on the Dialog is the point rather than decoration: it makes this an
 * `alertdialog`, which Escape and a backdrop click do NOT close, and it puts
 * initial focus on the confirming button. A destructive question should take a
 * real answer, not evaporate because somebody tapped beside it.
 *
 * The trigger is passed in as a child, so the caller owns what the button
 * looks like and this owns what happens after it is pressed.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pending,
  pendingLabel,
  onConfirm,
  open,
  onOpenChange,
}: {
  /** The control that opens this. Rendered as-is, via `asChild`. */
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  /** Defaults to the app's shared "cancel". */
  cancelLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { copy } = useCopy();

  return (
    <Dialog alert open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent placement="center" overlayBlur="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          {/* Cancel first in the DOM so `alert`'s focus rule — last button —
              lands on the destructive one, which is where somebody who opened
              this on purpose expects to be. Cancel stays one Tab away. */}
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={pending}
            onClick={() => onOpenChange?.(false)}
          >
            {cancelLabel ?? copy.common.cancel}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="md"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
