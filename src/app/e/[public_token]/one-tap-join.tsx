"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { Notice } from "@/components/notice";
import { PersonAvatar } from "@/components/person-avatar";

import { joinOneTap, type RsvpState } from "./actions";

export interface OneTapJoinProps {
  publicToken: string;
  displayName: string;
  avatarUrl: string | null;
  /** Event is at capacity, so this lands on the waitlist. Say so first. */
  isFull: boolean;
  /** Falls back to the full form — used when the name is taken. */
  onUseForm: () => void;
}

/**
 * Joining for somebody who is already signed in.
 *
 * One button, no fields. The RSVP form exists because an anonymous participant
 * has to say who they are; a signed-in one already has, so asking again is a
 * form standing between them and the only thing they came to do.
 *
 * The name and photo are shown before the tap, not after. This is the one
 * chance to notice that the account about to be added is the wrong one.
 */
export function OneTapJoin({
  publicToken,
  displayName,
  avatarUrl,
  isFull,
  onUseForm,
}: OneTapJoinProps) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<RsvpState>({ errors: {} });

  function join() {
    startTransition(async () => {
      const result = await joinOneTap(publicToken);
      setState(result);

      // The account's name is already on the roster. Nothing to do here but
      // hand over to the form, where they can pick something else.
      if (result.errors.nameTaken) onUseForm();
    });
  }

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{copy.rsvp.oneTapHeading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap="4">
          {state.errors._form ? (
            <Text color="error" role="alert">
              {state.errors._form}
            </Text>
          ) : null}

          {isFull ? <Notice tone="warning" title={copy.rsvp.willBeWaitlisted} /> : null}

          <Flex gap="3" align="center">
            <PersonAvatar src={avatarUrl} name={displayName} size="md" />
            <Text variant="small" color="muted">
              {copy.rsvp.signedInAs(displayName)}
            </Text>
          </Flex>

          <Button type="button" size="lg" fullWidth disabled={pending} onClick={join}>
            {pending ? copy.rsvp.oneTapSubmitting : copy.rsvp.oneTapSubmit(displayName)}
          </Button>

          <Text variant="small" color="muted">
            {copy.rsvp.oneTapHelp}
          </Text>

          <Button type="button" size="sm" variant="ghost" onClick={onUseForm}>
            {copy.rsvp.useAnotherName}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
