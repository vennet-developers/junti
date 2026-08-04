"use client";

import { useState } from "react";

import { Button } from "@stackmyth/button";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { canDeleteCommitment } from "@/domain/commitments";

import { deleteCommitment } from "./actions";

export interface CommitmentFeedItem {
  id: string;
  participantId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  note: string | null;
  reaction: string | null;
  /** Formatted on the server, in the reader's language and the event's zone. */
  when: string;
}

/**
 * Who is bringing what.
 *
 * Rendered from data the event page already loaded — no second request, no
 * spinner where the answer should be. It is visible to everyone who opens the
 * link, including a reader who has not answered yet, because seeing that four
 * people are bringing things is the argument for coming.
 *
 * Notes are plain text rendered as children, so React escapes them. Nothing
 * here interpolates markup, which is the whole of the XSS story for a feed of
 * user text.
 */
export function CommitmentFeed({
  publicToken,
  items,
  readerParticipantId,
  readerIsOrganizer,
}: {
  publicToken: string;
  items: CommitmentFeedItem[];
  /** The reader's own row on this event, if they are on it. */
  readerParticipantId: string | null;
  readerIsOrganizer: boolean;
}) {
  const { copy } = useCopy();

  if (items.length === 0) {
    return (
      <Stack gap="3">
        <Text variant="h3" fontFamily="var(--junti-display)">
          {copy.commitments.feedHeading}
        </Text>
        <Text variant="small" color="muted">
          {copy.commitments.feedEmpty}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="3">
      <Text variant="h3" fontFamily="var(--junti-display)">
        {copy.commitments.feedHeading}
      </Text>

      <Stack gap="0">
        {items.map((item, index) => (
          <Box key={item.id}>
            {index > 0 ? <Divider /> : null}
            <Box py="3">
              <Flex gap="3" align="start">
                <Box flexShrink={0}>
                  <PersonAvatar src={item.authorAvatarUrl} name={item.authorName} size="sm" />
                </Box>

                {/*
                  `flexGrow` is what pushes the reaction and the delete control
                  to the right edge. Without it every row packed left and the
                  "Borrar" landed wherever the name happened to end — a
                  different place on each row, which reads as debris rather
                  than as a column of controls.
                */}
                <Box minWidth="0" flexGrow={1}>
                  <Stack gap="1">
                    <Flex gap="2" align="baseline" wrap="wrap">
                      <Text weight="medium">{item.authorName}</Text>
                      <Text variant="small" color="muted">
                        {item.when}
                      </Text>
                    </Flex>

                    {item.note ? <Text>{item.note}</Text> : null}
                  </Stack>
                </Box>

                <Flex gap="2" align="center" flexShrink={0}>
                  {item.reaction ? (
                    /* Decorative beside the name it belongs to; the author is
                       already announced, so a screen reader gains nothing from
                       "soccer ball" here. */
                    <Text aria-hidden="true">{item.reaction}</Text>
                  ) : null}

                  {canDeleteCommitment({
                    authorParticipantId: item.participantId,
                    readerParticipantId,
                    readerIsOrganizer,
                  }) ? (
                    <RemoveButton
                      publicToken={publicToken}
                      noteId={item.id}
                      authorName={item.authorName}
                    />
                  ) : null}
                </Flex>
              </Flex>
            </Box>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function RemoveButton({
  publicToken,
  noteId,
  authorName,
}: {
  publicToken: string;
  noteId: string;
  authorName: string;
}) {
  const { copy } = useCopy();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
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
  );
}
