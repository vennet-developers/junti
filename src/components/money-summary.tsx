import { Divider, Flex, Stack } from "@stackmyth/layout";
import { Progress } from "@stackmyth/progress";
import { Stat } from "@stackmyth/stat";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";
import { formatMoney } from "@/lib/format";
import type { ParticipantRosterView } from "@/lib/roster";

/**
 * A server component, so `copy` comes down as a prop rather than through the
 * context hook — and it can, because nothing crosses the client boundary here.
 *
 * Takes the PARTICIPANT view, which both surfaces satisfy — the organizer's
 * full `RosterView` is a superset, so the console passes without a cast and
 * the participant page passes without one either. It used to take the full
 * view and the participant page reached it through `as never`, which is the
 * shape of cast that exists precisely because a boundary is being crossed
 * that the types would otherwise object to.
 *
 * The money is deliberately shared between the two roles. An event where four
 * people split a cancha is one where everybody can see the pot; what nobody
 * but the organizer sees is who paid an amount that does not match their
 * share, which is `discrepancies` and is not in this type.
 */
export function MoneySummary({ roster, copy }: { roster: ParticipantRosterView; copy: Copy }) {
  const { event, collectedMinor, outstandingMinor, waivedMinor, totalComputedMinor } = roster;
  const money = (amount: number) => formatMoney(amount, event.currency, copy.intlLocale);

  if (!event.hasCost) return null;

  const attendingCount = roster.attending.length;

  if (attendingCount === 0) {
    return (
      <Stack gap="2">
        <Text variant="h3" fontFamily="var(--junti-display)">
          {copy.money.heading}
        </Text>
        <Text variant="small" color="muted">
          {copy.money.nobodyIn}
        </Text>
      </Stack>
    );
  }

  // Waived money is neither collected nor owed, so it is excluded from the
  // denominator — otherwise the bar could never reach 100%.
  const target = collectedMinor + outstandingMinor;
  const percent = target > 0 ? Math.round((collectedMinor / target) * 100) : 100;

  return (
    <Stack gap="4">
      <Text variant="h3" fontFamily="var(--junti-display)">
        {copy.money.heading}
      </Text>

      {/*
        Stat renders its value at 32px — the same size as the page title. Two of
        those side by side at 390px shout louder than the event name and barely
        fit. Passing a Text node scales it down while keeping Stat's label /
        value structure and spacing.
      */}
      <Flex gap="5" wrap="wrap">
        <Stat
          label={copy.money.collectedLabel}
          value={
            <Text
              as="span"
              variant="h4"
              weight="bold"
              whiteSpace="nowrap"
              fontFamily="var(--junti-display)"
            >
              {money(collectedMinor)}
            </Text>
          }
        />
        <Stat
          label={copy.money.outstandingLabel}
          value={
            <Text
              as="span"
              variant="h4"
              weight="bold"
              whiteSpace="nowrap"
              fontFamily="var(--junti-display)"
            >
              {money(outstandingMinor)}
            </Text>
          }
        />
      </Flex>

      <Stack gap="1">
        <Progress
          value={percent}
          max={100}
          aria-label={copy.money.progressLabel(money(collectedMinor), money(target))}
        />
        <Text variant="small" color="muted">
          {copy.money.progressLabel(money(collectedMinor), money(target))}
        </Text>
      </Stack>

      <Divider />

      <Stack gap="1">
        <Flex justify="between" gap="2">
          <Text variant="small" color="muted">
            {copy.money.totalLabel}
          </Text>
          <Text variant="small">{money(totalComputedMinor)}</Text>
        </Flex>

        {event.costMode === "total" ? (
          <Flex justify="between" gap="2">
            <Text variant="small" color="muted">
              {copy.money.splitAmong(attendingCount)}
            </Text>
          </Flex>
        ) : (
          <Flex justify="between" gap="2">
            <Text variant="small" color="muted">
              {copy.money.perPersonLabel}
            </Text>
            <Text variant="small">{money(event.costAmountMinor ?? 0)}</Text>
          </Flex>
        )}

        {waivedMinor > 0 ? (
          <Flex justify="between" gap="2">
            <Text variant="small" color="muted">
              {copy.money.waived}
            </Text>
            <Text variant="small">{money(waivedMinor)}</Text>
          </Flex>
        ) : null}
      </Stack>
    </Stack>
  );
}
