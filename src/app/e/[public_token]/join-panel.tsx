"use client";

import { useState } from "react";

import { OneTapJoin } from "./one-tap-join";
import { RsvpForm } from "./rsvp-form";

export interface JoinPanelProps {
  publicToken: string;
  mine: { displayName: string; attendance: string } | null;
  isFull: boolean;
  /** The signed-in identity, or null. Never sent for a signed-out reader. */
  account: { displayName: string; avatarUrl: string | null } | null;
}

/**
 * Chooses between the one-tap button and the full form.
 *
 * A tiny client component whose whole job is to hold the "I'd rather type a
 * name" state — it exists so the page around it can stay a server component.
 *
 * Anyone already on the roster goes straight to the form: they are amending an
 * answer, and one-tap has nothing to offer someone who is already in.
 */
export function JoinPanel({ publicToken, mine, isFull, account }: JoinPanelProps) {
  const [useForm, setUseForm] = useState(false);

  const canOneTap = account !== null && mine === null && !useForm;

  if (canOneTap) {
    return (
      <OneTapJoin
        publicToken={publicToken}
        displayName={account.displayName}
        avatarUrl={account.avatarUrl}
        isFull={isFull}
        onUseForm={() => setUseForm(true)}
      />
    );
  }

  return <RsvpForm publicToken={publicToken} mine={mine} isFull={isFull} />;
}
