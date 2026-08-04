"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { CheckCircleIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { useRouter } from "@tanstack/react-router";

import { useCopy } from "@/components/copy-provider";
import { Notice } from "@/components/notice";
import { PersonAvatar } from "@/components/person-avatar";

import { joinOneTapFn, type RsvpState } from "./-fns";

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
 * One button, no fields. The session already knows who they are, so a form
 * asking again is nothing but an obstacle between them and the only thing
 * they came here to do. The name and photo are shown BEFORE the tap — the one
 * chance to notice the wrong Google account.
 *
 * **The answer lands before the server replies.** `joined` flips on the tap;
 * if the server comes back with an error the flip reverts and the card shows
 * why. Under Next this was `useOptimistic` + `useActionState`; the manual
 * state is the same behaviour with the rollback written out, because outside
 * React's form-action machinery there is nothing to do it for us. What made
 * the optimism safe carries over unchanged: the server function is idempotent
 * on the account, so the double-tap this speed invites cannot double-join.
 */
export function OneTapJoin({
  publicToken,
  displayName,
  avatarUrl,
  isFull,
  onUseForm,
}: OneTapJoinProps) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<RsvpState>({ errors: {} });
  const [joined, setJoined] = useState(false);

  function join() {
    setJoined(true);

    startTransition(async () => {
      const result = await joinOneTapFn({ data: { publicToken } });
      setState(result);

      if (Object.keys(result.errors).length > 0) {
        // Roll the optimistic receipt back; the card explains itself below.
        setJoined(false);
        // The account's name is already on the roster — hand over to the
        // form, where they can pick something else.
        if (result.errors.nameTaken) onUseForm();
        return;
      }

      // The roster now includes them; re-run the loaders so every part of
      // the page agrees (the server's revalidatePath, said the TanStack way).
      await router.invalidate();
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

          {joined ? (
            /* Where the button was, so nothing moves under a thumb still on
               the screen. The page re-renders without this card once the
               loaders catch up; until then this is the receipt. */
            <Flex gap="2" align="center" role="status">
              <CheckCircleIcon size={20} aria-hidden="true" />
              <Text weight="medium">{isFull ? copy.rsvp.waitlistedShort : copy.rsvp.saved}</Text>
            </Flex>
          ) : (
            <Button type="button" size="lg" fullWidth disabled={pending} onClick={join}>
              {pending ? copy.rsvp.oneTapSubmitting : copy.rsvp.oneTapSubmit(displayName)}
            </Button>
          )}

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
