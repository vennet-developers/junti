"use client";

import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Checkbox } from "@stackmyth/checkbox";
import { EmptyState } from "@stackmyth/empty-state";
import { CheckCircleIcon } from "@stackmyth/icons";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { EvidenceImage } from "@/components/evidence-image";
import { Link } from "@/components/link";

import { approveSubmissionsFn } from "./-fns";

export interface ApprovalRow {
  submissionId: string;
  eventTitle: string;
  participantName: string;
  policyLabel: string;
  note: string | null;
  /** Already formatted on the server, in the reader's language. */
  waitingSince: string;
  hasEvidence: boolean;
  managePath: string;
  evidencePath: string;
}

/**
 * The queue: every receipt waiting on a decision, oldest first.
 *
 * **Built for clearing, not for browsing.** An organizer running a weekly match
 * comes here on Thursday night with a dozen identical transfers to wave
 * through, and the cost that matters is the number of times they have to aim at
 * something. So the whole list is one tap to select, one tap to approve, and
 * the rows carry enough — who, which event, what they wrote, and the receipt
 * itself — to decide without opening anything.
 *
 * **Only approval is bulk.** Rejecting sends a reason back to the participant,
 * and a reason written once for twenty people is not a reason. The row links
 * into its event, which is where a rejection belongs.
 *
 * The list is the server's. Nothing is hidden optimistically: the server
 * function returns how many rows it actually decided — which is not always how
 * many were ticked, since a queue open in another tab may have resolved some
 * already — and that number is what gets reported before `router.invalidate()`
 * re-renders the page from the database.
 */
export function ApprovalQueue({ rows }: { rows: ApprovalRow[] }) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.submissionId)));
  }

  function approve() {
    const ids = [...selected];
    if (ids.length === 0) return;

    startTransition(async () => {
      const result = await approveSubmissionsFn({ data: { ids } });

      if (result.errors._form) {
        toast.error(result.errors._form);
        return;
      }

      setSelected(new Set());

      // `decided` rather than `ids.length`: the difference is the honest part.
      // Anything already resolved elsewhere was skipped by the statement, and
      // saying "approved 12" when 3 of them were spoken for would be a lie the
      // page corrects a second later.
      toast.success(
        result.decided && result.decided > 0
          ? copy.approvals.approvedNotice(result.decided)
          : copy.approvals.nothingLeft,
      );

      // What `revalidatePath("/", "layout")` did on the server under Next: the
      // roster, the pending counts and this queue all render from the same
      // rows, so every loader re-reads.
      await router.invalidate();
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircleIcon size={28} />}
        title={copy.approvals.emptyTitle}
        description={copy.approvals.emptyHelp}
      />
    );
  }

  return (
    <Stack gap="4">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Flex as="label" gap="2" align="center">
          {/* `indeterminate` when some but not all are ticked — the control
              says "partly selected" rather than lying in either direction. */}
          <Checkbox
            checked={allSelected}
            indeterminate={selected.size > 0 && !allSelected}
            onChange={toggleAll}
            disabled={pending}
          />
          <Text variant="small">
            {allSelected ? copy.approvals.clearSelection : copy.approvals.selectAll}
          </Text>
        </Flex>

        <Button
          type="button"
          size="md"
          disabled={selected.size === 0}
          loading={pending}
          loadingLabel={copy.approvals.approving}
          onClick={approve}
        >
          {copy.approvals.approveSelected(selected.size)}
        </Button>
      </Flex>

      <Text variant="small" color="muted">
        {copy.approvals.rejectHint}
      </Text>

      <Stack gap="3">
        {rows.map((row) => (
          <Card key={row.submissionId} surface="outlined">
            <CardContent>
              <Stack gap="3">
                <Flex gap="3" align="start">
                  <Box flexShrink={0} pt="1">
                    <Checkbox
                      checked={selected.has(row.submissionId)}
                      onChange={() => toggle(row.submissionId)}
                      disabled={pending}
                      aria-label={row.participantName}
                    />
                  </Box>

                  <Box minWidth="0">
                    <Stack gap="1">
                      <Text weight="semibold">{row.participantName}</Text>
                      <Text variant="small" color="muted">
                        {row.eventTitle}
                      </Text>
                      {row.note ? <Text variant="small">{row.note}</Text> : null}
                    </Stack>
                  </Box>

                  <Box flexShrink={0}>
                    <Badge variant="warning" size="sm" soft>
                      {row.policyLabel}
                    </Badge>
                  </Box>
                </Flex>

                {/* The receipt itself, organizer-only and served from the
                    event's own route. Here rather than a tab away: deciding on
                    a transfer is reading an amount off it, and doing that
                    elsewhere meant approving from memory. */}
                {row.hasEvidence ? (
                  <EvidenceImage
                    src={row.evidencePath}
                    alt={row.participantName}
                    expandLabel={copy.approvals.expandReceipt(row.participantName)}
                    goneLabel={copy.approvals.receiptGone}
                  />
                ) : (
                  <Text variant="small" color="muted">
                    {copy.approvals.noReceipt}
                  </Text>
                )}

                <Divider />

                <Flex justify="between" align="center" gap="3" wrap="wrap">
                  <Text variant="small" color="muted">
                    {copy.approvals.waitingSince(row.waitingSince)}
                  </Text>

                  <Button asChild size="sm" variant="ghost" shape="pill">
                    <Link href={row.managePath}>{copy.approvals.openEvent}</Link>
                  </Button>
                </Flex>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
