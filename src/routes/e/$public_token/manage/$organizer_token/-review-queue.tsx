"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Field, FieldLabel } from "@stackmyth/field";
import { Input } from "@stackmyth/input";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { EvidenceImage } from "@/components/evidence-image";

import { useRouter } from "@tanstack/react-router";

import { reviewSubmissionFn } from "./-fns";

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
 * The receipt is shown on the row. It used to open in a new tab, for two
 * reasons that a thumbnail answers better than a link did: a bank screenshot
 * is portrait and tall, so several of them inline at full size would be a
 * scroll marathon on a phone — hence a fixed collapsed height, expanded only
 * on request; and every image is a few hundred kilobytes on a queue that may
 * only be skimmed — hence lazy loading, so nothing below the fold is fetched
 * until it is reached. See `EvidenceImage`, shared with `/approvals`.
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // The pressed verdict spins; its neighbour only locks. And the tap ends in
  // a toast either way — a decision that visibly does nothing until the queue
  // rearranges itself invites the second tap that double-decides.
  const [inFlight, setInFlight] = useState<"approved" | "rejected" | null>(null);

  function decide(decision: "approved" | "rejected") {
    setInFlight(decision);
    startTransition(async () => {
      const result = await reviewSubmissionFn({
        data: { publicToken, organizerToken, submissionId: item.id, decision, reason },
      });

      if (result.errors._form) {
        toast.error(result.errors._form);
      } else {
        await router.invalidate();
        toast.success(
          decision === "approved" ? copy.review.approvedNotice : copy.review.rejectedNotice,
        );
        setRejecting(false);
        setReason("");
      }
      setInFlight(null);
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
            <EvidenceImage
              src={item.evidenceUrl}
              alt={item.participantName}
              expandLabel={copy.review.expandEvidence(item.participantName)}
              goneLabel={copy.review.evidenceGone}
            />
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
                  loading={inFlight === "rejected"}
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
                loading={inFlight === "approved"}
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
