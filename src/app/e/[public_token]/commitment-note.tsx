"use client";

import { useState } from "react";

import { Button } from "@stackmyth/button";
import { Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";

import { deleteCommitment } from "./actions";

/**
 * What one person said they are bringing, on their own row of the roster.
 *
 * This started life as a separate feed under its own heading, which put the
 * same seven sentences on the page twice over: once beside the name they
 * belong to and once in a list of names repeated. Under the name is where you
 * look for it — "is Caro bringing the ice?" is a question about Caro, not about
 * the feed — so the feed went and this stayed.
 *
 * The text renders as a React child, so it is escaped. Nothing here
 * interpolates markup, which is the whole of the XSS story for user text.
 */
export function CommitmentNote({
  publicToken,
  noteId,
  note,
  reaction,
  authorName,
  canDelete,
}: {
  publicToken: string;
  noteId: string;
  note: string | null;
  reaction: string | null;
  authorName: string;
  canDelete: boolean;
}) {
  const { copy } = useCopy();
  const [pending, setPending] = useState(false);

  return (
    <Flex gap="2" align="center" wrap="wrap">
      {reaction ? (
        /* Decorative: the author is announced by the row it sits under, so a
           screen reader gains nothing from "party popper" here. */
        <Text as="span" aria-hidden="true">
          {reaction}
        </Text>
      ) : null}

      {note ? (
        <Text variant="small" color="muted">
          {note}
        </Text>
      ) : null}

      {canDelete ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="junti-accion-peligro"
          disabled={pending}
          aria-label={`${copy.commitments.removeOne} — ${authorName}`}
          onClick={() => {
            setPending(true);
            void deleteCommitment(publicToken, noteId).finally(() => setPending(false));
          }}
        >
          {copy.commitments.removeOne}
        </Button>
      ) : null}
    </Flex>
  );
}
