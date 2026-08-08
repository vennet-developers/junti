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
  const { event, collectedMinor, outstandingMinor, totalComputedMinor } = roster;
  const money = (amount: number) => formatMoney(amount, event.currency, copy.intlLocale);

  if (!event.hasCost) return null;

  /*
    Null on all four means the reader has no session, so the money was never
    sent — see `toParticipantView`. Nothing to summarise, and nothing to say
    about the absence either: a signed-out reader is not missing a feature,
    they are reading a roster.
  */
  if (
    collectedMinor === null ||
    outstandingMinor === null ||
    totalComputedMinor === null
  ) {
    return null;
  }

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

  /*
    The GOAL is what the split says should come in — never
    `collected + outstanding`, which is a bar measuring itself: once everyone
    confirmed it reads "X de X" at ANY number, and Ivan caught it announcing
    "$176.000 de $176.000" over an event whose whole cost is $160.000.

    No waived subtraction any more: a waived share computes to zero and its
    cost already moved onto the people still paying, so the sum of the shares
    IS what there is to collect.
  */
  const goalMinor = Math.max(0, totalComputedMinor);
  const percent =
    goalMinor > 0 ? Math.min(100, Math.round((collectedMinor / goalMinor) * 100)) : 100;

  /*
    Collected can legitimately EXCEED the goal: money retained from a dropout
    under the refund policy, or somebody who paid more than their share. The
    bar caps at full and this names the difference instead of hiding it — the
    organizer holding more than the cost is a fact worth a sentence.
  */
  const surplusMinor = Math.max(0, collectedMinor - goalMinor);

  /*
    "Falta" measures against the GOAL, not against the roster. It used to be
    `outstandingMinor` — what the people already on the list still owe — and
    the moment the first quota was confirmed it read "$0" while the bar right
    under it said "$26.000 de $260.000": three numbers on one card and two of
    them contradicting the third, because the seats nobody has taken yet owe
    nothing to a roster-sum. What the organizer wants from this label is the
    distance to covered — goal minus collected, floor at zero.
  */
  const missingMinor = Math.max(0, goalMinor - collectedMinor);

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
              {money(missingMinor)}
            </Text>
          }
        />
      </Flex>

      <Stack gap="1">
        <Progress
          value={percent}
          max={100}
          aria-label={copy.money.progressLabel(money(collectedMinor), money(goalMinor))}
        />
        <Text variant="small" color="muted">
          {copy.money.progressLabel(money(collectedMinor), money(goalMinor))}
        </Text>
        {surplusMinor > 0 ? (
          <Text variant="small" color="muted">
            {copy.money.surplus(money(surplusMinor))}
          </Text>
        ) : null}
      </Stack>

      <Divider />

      <Stack gap="1">
        {/*
          The GOAL again, not the gross cost. With somebody waived the two
          differ, and this line used to show the gross while Falta and the
          bar measured the goal — "lo que falta no coincide con el total",
          exactly as Ivan read it. One reference number per card.
        */}
        <Flex justify="between" gap="2">
          <Text variant="small" color="muted">
            {copy.money.totalLabel}
          </Text>
          <Text variant="small">{money(goalMinor)}</Text>
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

        {/*
          The waived row is gone on purpose. An amount nobody is being
          charged is not part of the account — the quota distribution
          already absorbed the decision, and the person still wears their
          "Sin cobro" pill on the roster. Ivan: "no es necesario poner
          valores que no se están cobrando".
        */}
      </Stack>
    </Stack>
  );
}
