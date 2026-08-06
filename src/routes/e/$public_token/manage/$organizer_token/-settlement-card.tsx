import { useTransition } from "react";
import { useRouter } from "@tanstack/react-router";

import { Banner } from "@stackmyth/banner";
import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { TriangleAlertIcon } from "@stackmyth/icons";
import { Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { computeSettlement } from "@/domain/settlement";
import { formatMoney } from "@/lib/format";
import type { RosterView } from "@/lib/roster";

type SettlementRoster = Omit<RosterView, "compliance">;

import { settleTopUpFn } from "./-fns";

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
  const [pending, startTransition] = useTransition();

  const { event } = roster;
  if (!event.hasCost) return null;

  const attendanceOf = new Map(roster.members.map((m) => [m.id, m.attendance]));
  const names = new Map(roster.members.map((m) => [m.id, m.displayName]));

  const settlement = computeSettlement(
    roster.members.map((m) => m.share),
    (id) => attendanceOf.get(id) ?? "out",
  );

  if (settlement.topUps.length === 0 && settlement.refundables.length === 0) return null;

  const money = (minor: number) => formatMoney(minor, event.currency, copy.intlLocale);
  const strings = copy.settlement;

  function received(participantId: string) {
    startTransition(async () => {
      await settleTopUpFn({ data: { publicToken, organizerToken, participantId } });
      await router.invalidate();
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

          {settlement.topUps.length > 0 ? (
            <>
              <Banner
                variant="warning"
                live="off"
                icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
                title={strings.shortfall(money(settlement.shortfallMinor))}
              />

              <Stack gap="3">
                {settlement.topUps.map((topUp) => (
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
                        disabled={pending}
                        onClick={() => received(topUp.participantId)}
                      >
                        {pending ? strings.receiving : strings.received}
                      </Button>
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            </>
          ) : (
            <Text variant="small" color="muted">
              {strings.covered}
            </Text>
          )}

          {settlement.refundables.length > 0 ? (
            <>
              <Divider />
              <Text variant="small" color="muted">
                {strings.refundables(
                  settlement.refundables.length,
                  money(settlement.refundables.reduce((sum, r) => sum + r.paidMinor, 0)),
                )}
              </Text>
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
