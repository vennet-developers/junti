"use client";

import { useState } from "react";

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

  return (
    <Tabs value={tab} onValueChange={setTab} size="lg">
      <TabsList fullWidth>
        <TabsTrigger value="respuesta">{strings.tabs.answer}</TabsTrigger>
        {hasPolicies ? (
          <TabsTrigger value="comprobante" disabled={!joined}>
            {strings.tabs.requirements}
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="mensaje" disabled={!joined}>
          {strings.tabs.message}
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
              <Flex gap="2" align="baseline" justify="between" wrap="wrap">
                <Text variant="small" color="muted">
                  {strings.totalToPay}
                </Text>
                <Text as="span" variant="h4" weight="bold" fontFamily="var(--junti-display)">
                  {formatMoney(shareMinor, currency, copy.intlLocale)}
                </Text>
              </Flex>
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
