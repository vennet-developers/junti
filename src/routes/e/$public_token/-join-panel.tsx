"use client";

import { useState } from "react";

import { OneTapJoin } from "./-one-tap-join";
import { RsvpForm } from "./-rsvp-form";

export interface JoinPanelProps {
  publicToken: string;
  mine: { displayName: string; attendance: string } | null;
  isFull: boolean;
  /**
   * The signed-in identity. Not nullable: the page renders `SignInToJoin`
   * instead of this panel when nobody is signed in, so by the time we are here
   * there is always an account to join as.
   */
  account: { displayName: string; avatarUrl: string | null };
  /** The organizer's refund rule, when there is one. See `RsvpFormProps`. */
  refund: { hours: number; startsAt: Date } | null;
  /** Guest spots the answer can carry. See `RsvpFormProps`. */
  guests: { remaining: number } | null;
  /** Fires after a successful save, with the recorded answer. */
  onSaved?: (attendance: string) => void;
}

/**
 * Chooses between the one-tap button and the full form.
 *
 * A tiny client component whose whole job is to hold the "I'd rather type a
 * name" state — it exists so the page around it can stay a server component.
 *
 * The form is no longer how a stranger introduces themselves; the session does
 * that now. What is left for it is choosing a different name from the one on
 * the account, and amending an answer — which is why anyone already on the
 * roster goes straight to it, one-tap having nothing to offer someone who is
 * already in.
 */
export function JoinPanel({ publicToken, mine, isFull, account, refund, guests, onSaved }: JoinPanelProps) {
  const [useForm, setUseForm] = useState(false);

  if (mine === null && !useForm) {
    return (
      <OneTapJoin
        publicToken={publicToken}
        displayName={account.displayName}
        avatarUrl={account.avatarUrl}
        isFull={isFull}
        refund={refund}
        onSaved={onSaved}
        onUseForm={() => setUseForm(true)}
      />
    );
  }

  return (
    <RsvpForm
      publicToken={publicToken}
      mine={mine}
      isFull={isFull}
      refund={refund}
      guests={guests}
      onSaved={onSaved}
    />
  );
}
