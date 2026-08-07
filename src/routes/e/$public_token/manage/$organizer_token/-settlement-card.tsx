import { useState, useTransition } from "react";
import { useRouter } from "@tanstack/react-router";

import { Banner } from "@stackmyth/banner";
import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { TriangleAlertIcon } from "@stackmyth/icons";
import { Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { refundVerdict } from "@/domain/refund-policy";
import { computeSettlement, type Refundable } from "@/domain/settlement";
import { formatMoney } from "@/lib/format";
import type { RosterView } from "@/lib/roster";

type SettlementRoster = Omit<RosterView, "compliance">;

import { requestSettlementFn, settleTopUpFn } from "./-fns";

/**
 * "Cuentas finales": the dropout gap, as sentences with a button.
 *
 * Everything here is derived from the shares the page already holds —
 * `computeSettlement` invents no numbers, it reads the discrepancies the
 * split has always produced and the organizer has never seen as an action.
 * Rendered whenever there is something to settle rather than only after the
 * event: the gap opens the moment a paid-up person drops out, and an
 * organizer who sees it early can chase the difference while everyone still
 * remembers the plan.
 */
export function SettlementCard({
  publicToken,
  organizerToken,
  roster,
}: {
  publicToken: string;
  organizerToken: string;
  roster: SettlementRoster;
}) {
  const { copy } = useCopy();
  const router = useRouter();

  /*
    Rows settled optimistically, ahead of the server saying so.

    The press is the organizer stating a fact about the physical world — "I
    have the money in my hand" — and the app's write is bookkeeping after
    the fact. So the row leaves and the banner drops IMMEDIATELY, and the
    request runs underneath; waiting a round trip plus a full loader refresh
    to acknowledge cash already received made the button feel broken. Same
    contract as one-tap join: optimistic, with the rollback written out —
    a server error puts the row back and says why. The set survives the
    background refresh harmlessly: once the roster reflects the write, the
    settled row stops being a top-up at all.
  */
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
  const [requesting, startRequest] = useTransition();

  const { event } = roster;
  if (!event.hasCost) return null;

  const attendanceOf = new Map(roster.members.map((m) => [m.id, m.attendance]));
  const names = new Map(roster.members.map((m) => [m.id, m.displayName]));
  const outAtOf = new Map(roster.members.map((m) => [m.id, m.outAt]));

  const settlement = computeSettlement(
    roster.members.map((m) => m.share),
    (id) => attendanceOf.get(id) ?? "out",
  );

  // The card renders from these, never from settlement.topUps directly:
  // the optimistic set has already removed what the organizer just settled.
  const topUps = settlement.topUps.filter((topUp) => !settled.has(topUp.participantId));
  const shortfallMinor = topUps.reduce((sum, topUp) => sum + topUp.missingMinor, 0);

  if (topUps.length === 0 && settlement.refundables.length === 0) return null;

  const money = (minor: number) => formatMoney(minor, event.currency, copy.intlLocale);
  const strings = copy.settlement;

  function received(participantId: string) {
    // The receipt lands before the server replies — see the note on `settled`.
    setSettled((prev) => new Set(prev).add(participantId));
    toast.success(strings.receivedDone(names.get(participantId) ?? ""));

    void settleTopUpFn({ data: { publicToken, organizerToken, participantId } }).then(
      async (result) => {
        if (result.errors._form) {
          // Roll the row back into the list and say why — an optimistic
          // receipt that quietly stayed wrong would be a lie about money.
          setSettled((prev) => {
            const next = new Set(prev);
            next.delete(participantId);
            return next;
          });
          toast.error(result.errors._form);
          return;
        }

        // Background reconciliation: the rest of the page (Recaudado, the
        // payment stickers) catches up without holding the card hostage.
        await router.invalidate();
      },
    );
  }

  /*
    One press writes to everybody on the list above it. When to press —
    before the event because the roster clearly is not filling, or after it
    because it did not — is the organizer's read of their own group; the app
    only does the asking. The toast reports the real count, because "I asked
    everyone" and "three of eight had a verified email" are different facts.
  */
  function requestByEmail() {
    startRequest(async () => {
      const result = await requestSettlementFn({ data: { publicToken, organizerToken } });
      if ((result.sent ?? 0) > 0) {
        toast.success(strings.requested(result.sent ?? 0));
      } else {
        toast.info(strings.requestedNone);
      }
    });
  }

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="4">
          <Stack gap="1">
            <Text as="h2" variant="h4" fontFamily="var(--junti-display)">
              {strings.heading}
            </Text>
            <Text variant="small" color="muted">
              {strings.help}
            </Text>
          </Stack>

          {topUps.length > 0 ? (
            <>
              <Banner
                variant="warning"
                live="off"
                icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
                title={strings.shortfall(money(shortfallMinor))}
              />

              <Stack gap="3">
                {topUps.map((topUp) => (
                  <Flex key={topUp.participantId} gap="3" align="center" justify="between" wrap="wrap">
                    <Stack gap="1" minWidth="0">
                      <Text variant="small" weight="semibold">
                        {names.get(topUp.participantId) ?? "—"}
                      </Text>
                      <Text variant="small" color="muted">
                        {strings.row(money(topUp.paidMinor), money(topUp.finalShareMinor))}
                      </Text>
                    </Stack>
                    <Flex gap="3" align="center" flexShrink={0}>
                      <Text variant="small" weight="semibold">
                        {strings.missing(money(topUp.missingMinor))}
                      </Text>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => received(topUp.participantId)}
                      >
                        {strings.received}
                      </Button>
                    </Flex>
                  </Flex>
                ))}
              </Stack>

              <Flex justify="end">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={requesting}
                  onClick={requestByEmail}
                >
                  {requesting ? strings.requesting : strings.requestEmails}
                </Button>
              </Flex>
            </>
          ) : (
            <Text variant="small" color="muted">
              {strings.covered}
            </Text>
          )}

          {settlement.refundables.length > 0 ? (
            <>
              <Divider />
              {event.refundNoticeHours === null ? (
                /* No stated rule, so no verdicts: the app reports the fact
                   and stays out of the decision, as it always has. */
                <Text variant="small" color="muted">
                  {strings.refundables(
                    settlement.refundables.length,
                    money(settlement.refundables.reduce((sum, r) => sum + r.paidMinor, 0)),
                  )}
                </Text>
              ) : (
                <DropoutVerdicts
                  refundables={settlement.refundables}
                  shortfallMinor={shortfallMinor}
                  noticeHours={event.refundNoticeHours}
                  startsAt={event.startsAt}
                  names={names}
                  outAtOf={outAtOf}
                  money={money}
                />
              )}
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * The dropouts' money, judged against the stated rule.
 *
 * Once the organizer wrote a policy on the event, "devolver o contar" stops
 * being an open question and becomes a verdict per person: enough notice and
 * the money goes back, a late bail and the policy keeps it. Drops that
 * predate `out_at` tracking are said to be unknown rather than guessed —
 * accusing somebody of bailing late on missing evidence is the one wrong
 * answer here.
 *
 * Still sentences, never writes: the money lives in the organizer's pocket
 * either way, and the app's job ends at saying what the rule they published
 * concludes.
 */
function DropoutVerdicts({
  refundables,
  shortfallMinor,
  noticeHours,
  startsAt,
  names,
  outAtOf,
  money,
}: {
  refundables: Refundable[];
  shortfallMinor: number;
  noticeHours: number;
  startsAt: Date;
  names: Map<string, string>;
  outAtOf: Map<string, Date | null>;
  money: (minor: number) => string;
}) {
  const { copy } = useCopy();
  const strings = copy.settlement;

  const judged = refundables.map((refundable) => ({
    ...refundable,
    verdict: refundVerdict({
      noticeHours,
      startsAt,
      outAt: outAtOf.get(refundable.participantId) ?? null,
    }),
  }));

  const forfeitedMinor = judged
    .filter((r) => r.verdict === "forfeit")
    .reduce((sum, r) => sum + r.paidMinor, 0);

  return (
    <Stack gap="3">
      <Text variant="small" weight="semibold">
        {strings.dropouts}
      </Text>

      {judged.map((refundable) => (
        <Flex key={refundable.participantId} gap="3" align="center" justify="between" wrap="wrap">
          <Text variant="small" weight="semibold">
            {names.get(refundable.participantId) ?? "—"}
          </Text>
          <Text variant="small" color="muted">
            {strings.dropoutPaid(money(refundable.paidMinor))}
            {" · "}
            {refundable.verdict === "refund"
              ? strings.verdictRefund(noticeHours)
              : refundable.verdict === "forfeit"
                ? strings.verdictForfeit(noticeHours)
                : strings.verdictUnknown}
          </Text>
        </Flex>
      ))}

      {/* What the kept money does to the banner above: an organizer holding
          $16.000 a late dropout forfeited is NOT out of pocket by the full
          shortfall, and saying so is the difference between chasing eight
          people and chasing four. */}
      {forfeitedMinor > 0 && shortfallMinor > 0 ? (
        <Text variant="small" color="muted">
          {strings.forfeitCoversGap(money(Math.min(forfeitedMinor, shortfallMinor)))}
        </Text>
      ) : null}
    </Stack>
  );
}
