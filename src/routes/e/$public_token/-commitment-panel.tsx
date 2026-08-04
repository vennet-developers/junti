"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";

import { useCopy } from "@/components/copy-provider";
import { NOTE_MAX, REACTIONS, noteLength } from "@/domain/commitments";

import { useRouter } from "@tanstack/react-router";

import { deleteCommitmentFn, saveCommitmentFn, type RsvpState } from "./-fns";

export interface CommitmentPanelProps {
  publicToken: string;
  /** The reader's existing note, if they have one. */
  own: { id: string; note: string | null; reaction: string | null } | null;
}

/**
 * Saying what you are bringing.
 *
 * Only shown to somebody already on the roster: this is the sentence after
 * "I'm in", not a way to be in. It is also the cheapest reason to come back to
 * the page before the event — attendance answers whether it happens, this is
 * what makes it feel like it is happening.
 *
 * **Quick picks first, free text underneath.** Almost every commitment on a
 * group plan is one of four sentences, and tapping one is faster than typing
 * it on a phone. They fill the box rather than submitting, so the picked
 * sentence can still be edited — "Yo llevo el balón" becomes "Yo llevo el
 * balón y la malla" without retyping.
 *
 * Submits imperatively through the server function, like every other form in
 * the app now. The reaction rides along as a hidden field because the picker
 * is a row of buttons rather than a native control.
 */
export function CommitmentPanel({ publicToken, own }: CommitmentPanelProps) {
  const { copy } = useCopy();

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<RsvpState>({ errors: {} });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("publicToken", publicToken);

    startTransition(async () => {
      const result = await saveCommitmentFn({ data: formData });
      setState(result);
      // The feed under the roster shows the note now — re-run the loaders,
      // which is what the server's revalidatePath used to trigger.
      if (result.ok) await router.invalidate();
    });
  }

  const [note, setNote] = useState(own?.note ?? "");
  const [reaction, setReaction] = useState(own?.reaction ?? "");

  const left = NOTE_MAX - noteLength(note);
  const over = left < 0;

  return (
    <Card surface="outlined">
      <CardHeader>
        <CardTitle>{copy.commitments.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap="4">
          <Text variant="small" color="muted">
            {copy.commitments.help}
          </Text>

          {state.errors._form ? (
            <Text color="error" role="alert">
              {state.errors._form}
            </Text>
          ) : null}

          {/* Fills the box instead of submitting: the sentence is a starting
              point, and the most common edit is adding to it. */}
          <Flex gap="2" wrap="wrap">
            {copy.commitments.quickPicks.map((pick) => (
              <Button
                key={pick}
                type="button"
                size="sm"
                variant="outline"
                shape="pill"
                onClick={() => setNote(pick)}
              >
                {pick}
              </Button>
            ))}
          </Flex>

          <form onSubmit={submit}>
            <Stack gap="3">
              <Textarea
                name="note"
                fullWidth
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={copy.commitments.notePlaceholder}
              />

              <Flex justify="between" align="center" gap="2" wrap="wrap">
                <Text variant="small" color={over ? "error" : "muted"}>
                  {left}
                </Text>
              </Flex>

              <Text variant="small" color="muted">
                {copy.commitments.reactionLabel}
              </Text>

              {/*
                A fixed row rather than a picker. Arbitrary emoji render as a
                box on somebody's phone, and there is no moderation queue to
                catch the ones that are a problem — see `REACTIONS`.
              */}
              <Flex gap="2" wrap="wrap">
                {REACTIONS.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    size="sm"
                    variant={reaction === emoji ? "primary" : "ghost"}
                    soft={reaction === emoji}
                    aria-pressed={reaction === emoji}
                    onClick={() => setReaction(reaction === emoji ? "" : emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </Flex>

              <input type="hidden" name="reaction" value={reaction} />

              <Flex gap="2" wrap="wrap">
                <Button type="submit" size="md" disabled={pending || over}>
                  {pending
                    ? copy.commitments.saving
                    : own
                      ? copy.commitments.update
                      : copy.commitments.save}
                </Button>

                {own ? <RemoveOwn publicToken={publicToken} noteId={own.id} /> : null}
              </Flex>
            </Stack>
          </form>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Outside the form, so it never submits it — its own action, its own button. */
function RemoveOwn({ publicToken, noteId }: { publicToken: string; noteId: string }) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      size="md"
      variant="ghost"
      className="junti-accion-peligro"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void deleteCommitmentFn({ data: { publicToken, noteId } })
          .then(() => router.invalidate())
          .finally(() => setPending(false));
      }}
    >
      {copy.commitments.remove}
    </Button>
  );
}
