"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Field, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";

import { reviewSubmission } from "./actions";

export interface ReviewItem {
  id: string;
  participantName: string;
  policyLabel: string;
  note: string | null;
  submittedAt: string;
  hasEvidence: boolean;
  /** Organizer-only route. Never rendered on the participant page. */
  evidenceUrl: string;
}

/**
 * What the organizer has to decide on.
 *
 * The receipt opens in a new tab rather than being shown inline. Two reasons:
 * a bank screenshot is portrait and tall, so inlining several of them turns
 * this into a scroll marathon on a phone; and pulling every image into the page
 * would mean loading a few hundred kilobytes per row to render a queue the
 * organizer may only skim.
 */
export function ReviewQueue({
  publicToken,
  organizerToken,
  items,
}: {
  publicToken: string;
  organizerToken: string;
  items: ReviewItem[];
}) {
  const { copy } = useCopy();

  if (items.length === 0) {
    return (
      <Text variant="small" color="muted">
        {copy.review.empty}
      </Text>
    );
  }

  return (
    <Stack gap="3">
      {items.map((item) => (
        <ReviewRow
          key={item.id}
          publicToken={publicToken}
          organizerToken={organizerToken}
          item={item}
        />
      ))}
    </Stack>
  );
}

function ReviewRow({
  publicToken,
  organizerToken,
  item,
}: {
  publicToken: string;
  organizerToken: string;
  item: ReviewItem;
}) {
  const { copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function decide(decision: "approved" | "rejected") {
    startTransition(async () => {
      await reviewSubmission(publicToken, organizerToken, item.id, decision, reason);
      setRejecting(false);
      setReason("");
    });
  }

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <Stack gap="1">
            <Text weight="semibold">{item.policyLabel}</Text>
            <Text variant="small" color="muted">
              {copy.review.submittedBy(item.participantName, item.submittedAt)}
            </Text>
          </Stack>

          {item.note ? <Text variant="small">{item.note}</Text> : null}

          {item.hasEvidence ? (
            <Button asChild size="md" variant="secondary" fullWidth>
              {/* Box(as="a") so `asChild` clones a Stackmyth primitive — same
                  reason as the WhatsApp button above. */}
              <Box as="a" href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">
                {copy.review.viewEvidence}
              </Box>
            </Button>
          ) : (
            <Text variant="small" color="muted">
              {copy.review.noEvidence}
            </Text>
          )}

          {rejecting ? (
            <Stack gap="2">
              <Field>
                <FieldLabel htmlFor={`reason-${item.id}`}>{copy.review.reasonLabel}</FieldLabel>
                <Input
                  id={`reason-${item.id}`}
                  fullWidth
                  size="lg"
                  maxLength={200}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={copy.review.reasonPlaceholder}
                />
              </Field>
              <Text variant="small" color="muted">
                {copy.review.reasonHelp}
              </Text>
              <Flex gap="2" wrap="wrap">
                <Button
                  type="button"
                  size="md"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => decide("rejected")}
                >
                  {copy.review.reject}
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setRejecting(false)}
                >
                  {copy.common.cancel}
                </Button>
              </Flex>
            </Stack>
          ) : (
            <Flex gap="2" wrap="wrap">
              <Button
                type="button"
                size="md"
                variant="success"
                disabled={pending}
                onClick={() => decide("approved")}
              >
                {copy.review.approve}
              </Button>
              {/* Rejecting asks for a reason first. Without one the participant
                  is told "no" with nothing to act on, and simply sends the same
                  photo again. */}
              <Button
                type="button"
                size="md"
                variant="destructive"
                soft
                disabled={pending}
                onClick={() => setRejecting(true)}
              >
                {copy.review.reject}
              </Button>
            </Flex>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
