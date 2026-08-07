"use client";

import { useState } from "react";

import { Badge } from "@stackmyth/badge";
import { Banner } from "@stackmyth/banner";
import { CheckCircleIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stackmyth/tabs";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { formatMoney } from "@/lib/format";

import { CommitmentPanel, type CommitmentPanelProps } from "./-commitment-panel";
import { HeldSpotsPanel, type HeldSpotView } from "./-held-spots-panel";
import { JoinPanel, type JoinPanelProps } from "./-join-panel";
import { PolicyPanel, type PolicyPanelItem } from "./-policy-panel";

/**
 * Joining, as the three-tab wizard Ivan specified.
 *
 * 1 · **Respuesta** — the answer, and how many seats it carries (yours plus
 *     guests, declared right there). 2 · **Comprobante** — what the event
 *     requires before you count, led by the total to pay and an honest "you
 *     are not confirmed yet". 3 · **Mensaje** — the sentence on the event,
 *     published only once its author is confirmed.
 *
 * The wizard part is ONE moment: the instant an answer of "voy" lands on an
 * event with requirements, the view advances to Comprobante — the receipt is
 * the second half of the same acceptance, not an errand discovered later.
 * Every other visit these are plain tabs that open on Respuesta, because a
 * returning participant is here to change something, not to be walked
 * through a flow they already finished.
 *
 * Tabs 2 and 3 are disabled until there is an answer to hang them off — a
 * receipt with no spot and a message from nobody are both nothing.
 */
export function JoinWizard({
  join,
  policies,
  hasPolicies,
  commitment,
  guestsHeld,
  shareMinor,
  currency,
  answersOpen,
  attendance,
}: {
  /** Everything the Respuesta tab's form needs. */
  join: JoinPanelProps;
  /** My standing against each requirement. Empty until joined. */
  policies: PolicyPanelItem[];
  /** Whether the EVENT has requirements — decides if tab 2 exists at all. */
  hasPolicies: boolean;
  commitment: Omit<CommitmentPanelProps, "publicToken">;
  /** Spots I already hold, for the management list under the form. */
  guestsHeld: HeldSpotView[];
  /** My total to pay — my share, guests included. Null on a free event. */
  shareMinor: number | null;
  currency: string;
  answersOpen: boolean;
  /** My recorded answer, or null before one exists. */
  attendance: string | null;
}) {
  const { copy } = useCopy();
  const strings = copy.joinWizard;

  // Always lands on Respuesta — a returning participant is changing
  // something, not re-running a flow. The one auto-advance is below.
  const [tab, setTab] = useState("respuesta");

  const joined = attendance !== null;
  const confirmed =
    hasPolicies && policies.length > 0 && policies.every((item) => item.state === "approved");

  const publicToken = join.publicToken;

  /*
    The numbered circle before each label — Ivan's ask, and the right UX
    call: three tabs alone read as places, and this flow is a SEQUENCE the
    first time through. A number in a soft badge (a single digit in a pill
    IS a circle) says "this comes second" without a single word. Numbering
    is positional: on an event without requirements, Mensaje is 2.

    Green once the step is DONE — answered, confirmed, published — gray
    while it waits. A comprobante merely sent stays gray on purpose: the
    tab's own banner says "not confirmed yet", and a green 2 above a yellow
    "still pending" would be the interface disagreeing with itself.
  */
  const stepBadge = (n: number, done: boolean) => (
    <Badge variant={done ? "success" : "secondary"} size="sm" soft aria-hidden="true">
      {n}
    </Badge>
  );

  return (
    <Tabs value={tab} onValueChange={setTab} size="lg">
      <TabsList fullWidth>
        <TabsTrigger value="respuesta">
          <Flex gap="2" align="center">
            {stepBadge(1, joined)}
            {strings.tabs.answer}
          </Flex>
        </TabsTrigger>
        {hasPolicies ? (
          <TabsTrigger value="comprobante" disabled={!joined}>
            <Flex gap="2" align="center">
              {stepBadge(2, confirmed)}
              {strings.tabs.requirements}
            </Flex>
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="mensaje" disabled={!joined}>
          <Flex gap="2" align="center">
            {stepBadge(hasPolicies ? 3 : 2, commitment.own !== null)}
            {strings.tabs.message}
          </Flex>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="respuesta">
        <Stack gap="4" pt="4">
          {answersOpen ? (
            <JoinPanel
              {...join}
              onSaved={(saved) => {
                // The one wizard moment: "voy" on an event with requirements
                // advances straight to the receipt — the second half of the
                // same acceptance.
                if (saved === "in" && hasPolicies) setTab("comprobante");
              }}
            />
          ) : joined ? (
            <Text variant="small" color="muted">
              {strings.answersClosedButRecorded}
            </Text>
          ) : null}

          {/* The seats I already answer for — links to hand out, releases.
              Holding NEW ones happens inside the form above, with the answer. */}
          {joined && attendance === "in" && guestsHeld.length > 0 ? (
            <HeldSpotsPanel publicToken={publicToken} spots={guestsHeld} />
          ) : null}
        </Stack>
      </TabsContent>

      {hasPolicies ? (
        <TabsContent value="comprobante">
          <Stack gap="4" pt="4">
            {confirmed ? (
              <Banner
                variant="success"
                live="off"
                icon={<CheckCircleIcon size={18} aria-hidden="true" />}
                title={strings.confirmedBanner}
              />
            ) : (
              <Banner
                variant="warning"
                live="off"
                icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
                title={strings.pendingBanner}
              />
            )}

            {shareMinor !== null && shareMinor > 0 ? (
              <Stack gap="1">
                <Flex gap="2" align="baseline" justify="between" wrap="wrap">
                  <Text variant="small" color="muted">
                    {strings.yourShare}
                  </Text>
                  <Text as="span" variant="h4" weight="bold" fontFamily="var(--junti-display)">
                    {formatMoney(shareMinor, currency, copy.intlLocale)}
                  </Text>
                </Flex>
                {guestsHeld.filter((g) => !g.claimed).length > 0 ? (
                  <Text variant="small" color="muted">
                    {strings.shareIncludesGuests(guestsHeld.filter((g) => !g.claimed).length)}
                  </Text>
                ) : null}
              </Stack>
            ) : null}

            <PolicyPanel publicToken={publicToken} items={policies} />
          </Stack>
        </TabsContent>
      ) : null}

      <TabsContent value="mensaje">
        <Stack gap="4" pt="4">
          {hasPolicies && !confirmed ? (
            <Text variant="small" color="muted">
              {strings.messageHeldNote}
            </Text>
          ) : null}
          <CommitmentPanel publicToken={publicToken} own={commitment.own} />
        </Stack>
      </TabsContent>
    </Tabs>
  );
}
