"use client";

import { useState, useTransition } from "react";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { formatMoney } from "@/lib/format";

import { settleCreditFn } from "./-fns";

export interface CreditLine {
  id: string;
  availableMinor: number;
  currency: string;
  counterpartName: string;
  originEventTitle: string | null;
}

/**
 * Standing credit, both directions, on the screen that belongs to a person.
 *
 * **Not a wallet, and the words work hard to say so.** Junti holds no money:
 * these are debts between two people who play together, and the only thing
 * the app does about them is remember whose is whose and take them off the
 * next quota automatically. There is no withdraw button because there is
 * nothing to withdraw from.
 *
 * Two lists on one card because they are the same fact from both ends, and
 * an organizer is usually on both. Owed-to-you reassures; owed-by-you is the
 * half that gets debts settled — ten people scattered across old events is
 * invisible, and one line saying you owe ten people is not.
 */
export function CreditsPanel({
  owedToYou,
  owedByYou,
}: {
  owedToYou: CreditLine[];
  owedByYou: CreditLine[];
}) {
  const { copy } = useCopy();
  const strings = copy.credits;

  // Optimistic, like every other money control here: the row leaves on the
  // tap and comes back with a reason if the server refuses.
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const owing = owedByYou.filter((credit) => !settled.has(credit.id));

  if (owedToYou.length === 0 && owing.length === 0) return null;

  const money = (credit: CreditLine) =>
    formatMoney(credit.availableMinor, credit.currency, copy.intlLocale);

  function settle(creditId: string) {
    setSettled((prev) => new Set(prev).add(creditId));

    startTransition(async () => {
      const result = await settleCreditFn({ data: { creditId } });

      if (result.errors._form) {
        setSettled((prev) => {
          const next = new Set(prev);
          next.delete(creditId);
          return next;
        });
        toast.error(result.errors._form);
        return;
      }

      toast.success(strings.settledDone);
    });
  }

  const origin = (credit: CreditLine) =>
    credit.originEventTitle
      ? strings.fromEvent(credit.originEventTitle)
      : strings.fromEventUnknown;

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

          {owedToYou.length > 0 ? (
            <Stack gap="3">
              <Text variant="small" weight="semibold">
                {strings.owedToYouHeading}
              </Text>
              {owedToYou.map((credit) => (
                <Flex key={credit.id} gap="3" align="center" justify="between" wrap="wrap">
                  <Stack gap="1" minWidth="0">
                    <Text variant="small" weight="medium">
                      {credit.counterpartName}
                    </Text>
                    <Text variant="small" color="muted">
                      {origin(credit)}
                    </Text>
                  </Stack>
                  <Text variant="small" weight="semibold" whiteSpace="nowrap">
                    {money(credit)}
                  </Text>
                </Flex>
              ))}
            </Stack>
          ) : null}

          {owedToYou.length > 0 && owing.length > 0 ? <Divider /> : null}

          {owing.length > 0 ? (
            <Stack gap="3">
              <Text variant="small" weight="semibold">
                {strings.owedByYouHeading}
              </Text>
              {owing.map((credit) => (
                <Flex key={credit.id} gap="3" align="center" justify="between" wrap="wrap">
                  <Stack gap="1" minWidth="0">
                    <Text variant="small" weight="medium">
                      {credit.counterpartName}
                    </Text>
                    <Text variant="small" color="muted">
                      {origin(credit)}
                    </Text>
                  </Stack>
                  <Flex gap="3" align="center" flexShrink={0}>
                    <Text variant="small" weight="semibold" whiteSpace="nowrap">
                      {money(credit)}
                    </Text>
                    {/* Only the person who OWES may close a debt, and only by
                        saying they paid it — the app cannot verify that, and
                        does not pretend to, exactly as with any payment. */}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => settle(credit.id)}
                    >
                      {strings.settle}
                    </Button>
                  </Flex>
                </Flex>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
