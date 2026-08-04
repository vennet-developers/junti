"use client";

import { useActionState, useEffect, useOptimistic } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { CheckCircleIcon } from "@stackmyth/icons";
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
 * One button, no fields. The session already knows who they are, so a form
 * asking again is nothing but an obstacle between them and the only thing they
 * came here to do. The full form still exists for the person whose account name
 * is not what this group calls them.
 *
 * The name and photo are shown before the tap, not after. This is the one
 * chance to notice that the account about to be added is the wrong one.
 *
 * **A real form, submitted to a server action.** It was a `<button onClick>`,
 * which meant the one screen the whole product funnels into did nothing at all
 * until React had loaded and hydrated — on the phone, on mobile data, opening a
 * WhatsApp link. Now the markup posts on its own and JavaScript only makes it
 * nicer: the same button, the same action, one round trip either way.
 *
 * **The answer lands before the server replies.** `useOptimistic` flips the card
 * to "you're on the list" on the tap, and React rolls it back by itself if the
 * action comes back with an error. Perceived latency was the entire round trip
 * before — on a bad connection, long enough to tap twice, which is why the
 * action is idempotent on the account.
 */
export function OneTapJoin({
  publicToken,
  displayName,
  avatarUrl,
  isFull,
  onUseForm,
}: OneTapJoinProps) {
  const { copy } = useCopy();

  const [state, formAction, pending] = useActionState(joinOneTap.bind(null, publicToken), {
    errors: {},
  } satisfies RsvpState);

  /*
    Optimistically "in". The reducer ignores its current value on purpose —
    there is one transition here and it only ever moves one way. React discards
    this the moment the action settles, so a failure needs no rollback of its
    own: the card comes back with the error on it.
  */
  const [joined, setJoined] = useOptimistic(false, (_current, next: boolean) => next);

  // The account's name is already on the roster. Nothing to do here but hand
  // over to the form, where they can pick something else.
  useEffect(() => {
    if (state.errors.nameTaken) onUseForm();
  }, [state.errors.nameTaken, onUseForm]);

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
            /*
              Where the button was, so nothing moves under a thumb that is
              still on the screen. The page re-renders without this card once
              the server confirms; until then this is the receipt.
            */
            <Flex gap="2" align="center" role="status">
              <CheckCircleIcon size={20} aria-hidden="true" />
              <Text weight="medium">{isFull ? copy.rsvp.waitlistedShort : copy.rsvp.saved}</Text>
            </Flex>
          ) : (
            <form action={formAction} onSubmit={() => setJoined(true)}>
              <Button type="submit" size="lg" fullWidth disabled={pending}>
                {pending ? copy.rsvp.oneTapSubmitting : copy.rsvp.oneTapSubmit(displayName)}
              </Button>
            </form>
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
