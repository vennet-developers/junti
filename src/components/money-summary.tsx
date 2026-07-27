import { Divider, Flex, Stack } from "@stackmyth/layout";
import { Progress } from "@stackmyth/progress";
import { Stat } from "@stackmyth/stat";
import { Text } from "@stackmyth/text";

import { copy } from "@/config/copy";
import { formatMoney } from "@/lib/format";
import type { RosterView } from "@/lib/roster";

export function MoneySummary({ roster }: { roster: RosterView }) {
  const { event, collectedMinor, outstandingMinor, waivedMinor, totalComputedMinor } = roster;

  if (!event.hasCost) return null;

  const attendingCount = roster.attending.length;

  if (attendingCount === 0) {
    return (
      <Stack gap="2">
        <Text variant="h3">{copy.money.heading}</Text>
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
      <Text variant="h3">{copy.money.heading}</Text>

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
            <Text as="span" variant="h4" weight="bold" whiteSpace="nowrap">
              {formatMoney(collectedMinor, event.currency)}
            </Text>
          }
        />
        <Stat
          label={copy.money.outstandingLabel}
          value={
            <Text as="span" variant="h4" weight="bold" whiteSpace="nowrap">
              {formatMoney(outstandingMinor, event.currency)}
            </Text>
          }
        />
      </Flex>

      <Stack gap="1">
        <Progress
          value={percent}
          max={100}
          aria-label={copy.money.progressLabel(
            formatMoney(collectedMinor, event.currency),
            formatMoney(target, event.currency),
          )}
        />
        <Text variant="small" color="muted">
          {copy.money.progressLabel(
            formatMoney(collectedMinor, event.currency),
            formatMoney(target, event.currency),
          )}
        </Text>
      </Stack>

      <Divider />

      <Stack gap="1">
        <Flex justify="between" gap="2">
          <Text variant="small" color="muted">
            {copy.money.totalLabel}
          </Text>
          <Text variant="small">{formatMoney(totalComputedMinor, event.currency)}</Text>
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
            <Text variant="small">{formatMoney(event.costAmountMinor ?? 0, event.currency)}</Text>
          </Flex>
        )}

        {waivedMinor > 0 ? (
          <Flex justify="between" gap="2">
            <Text variant="small" color="muted">
              {copy.money.waived}
            </Text>
            <Text variant="small">{formatMoney(waivedMinor, event.currency)}</Text>
          </Flex>
        ) : null}
      </Stack>
    </Stack>
  );
}
