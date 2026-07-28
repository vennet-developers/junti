import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@stackmyth/button";
import { Box, Container, Divider, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { EventHeader } from "@/components/event-header";
import { LinkPanel } from "@/components/link-panel";
import { MoneySummary } from "@/components/money-summary";
import { Disclosure } from "@/components/disclosure";
import { Notice } from "@/components/notice";
import { RosterGroup } from "@/components/roster-list";
import { copy } from "@/config/copy";
import { formatEventDateTimeShort, formatMoney } from "@/lib/format";
import { getOrganizer } from "@/lib/organizer";
import { authorizeOrganizer, loadRoster } from "@/lib/roster";
import { managePath, origin, participantPath, whatsAppShareUrl } from "@/lib/urls";

import { CloseEventControl } from "./close-event-control";
import { AddParticipantForm, EditEventForm } from "./manage-forms";
import { PaymentControls, PromoteControl, RemoveControl } from "./participant-controls";

/**
 * The organizer view.
 *
 * Reached only with both tokens. Everything the participant page shows, plus
 * the controls. Every mutation re-checks the token pair server-side — being on
 * this page is not itself proof of anything.
 */

type Params = { public_token: string; organizer_token: string };

export const metadata: Metadata = {
  title: copy.manage.title,
  robots: { index: false, follow: false },
};

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { public_token: publicToken, organizer_token: organizerToken } = await params;
  const { created } = await searchParams;

  const organizer = await getOrganizer();
  const eventRow = await authorizeOrganizer(publicToken, organizerToken, organizer?.id ?? null);
  if (!eventRow) notFound();

  const roster = await loadRoster(eventRow);
  const { event } = roster;

  const base = await origin();
  const participantUrl = `${base}${participantPath(publicToken)}`;
  const manageUrl = `${base}${managePath(publicToken, organizerToken)}`;

  const shareMessage = copy.share.whatsAppMessage(
    event.title,
    formatEventDateTimeShort(event.startsAt),
    participantUrl,
  );

  const justCreated = created === "1";
  const showMoney = event.hasCost;

  const nameOf = (participantId: string) =>
    roster.members.find((m) => m.id === participantId)?.displayName ?? "";

  return (
    <Container size="1">
      <Stack gap="6" py="6" px="4">
        {/* The event itself comes first. On a return visit that is what the
            organizer opened the page for; the links are one tap away below. */}
        <EventHeader event={event} attendingCount={roster.attending.length} />

        {justCreated ? (
          <Stack gap="2">
            <Text variant="h3">{copy.eventCreated.heading}</Text>
            <Text color="muted">{copy.eventCreated.subheading}</Text>
          </Stack>
        ) : null}

        {/* Expanded only right after creation, when the links ARE the task.
            Collapsed on every later visit. */}
        <Disclosure id="share" label={copy.manage.shareSection} defaultOpen={justCreated}>
          <Stack gap="5">
            <LinkPanel
              label={copy.eventCreated.participantLinkLabel}
              help={copy.eventCreated.participantLinkHelp}
              url={participantUrl}
              copyLabel={copy.share.copyParticipantLink}
            />

            {/*
            Box(as="a"), so the element Button clones is still a Stackmyth
            primitive — `asChild` needs a single child element, which is the
            only reason there is a wrapper here.

            Note: `next dev` reports a hydration mismatch on this subtree after
            a hot reload, for any child type including a plain <a>. It is an HMR
            artifact — a production build renders the merged classes identically
            on both sides and logs nothing. See STACKMYTH-GAPS.md #13.
          */}
            <Button asChild fullWidth size="lg">
              <Box
                as="a"
                href={whatsAppShareUrl(shareMessage)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.eventCreated.shareWhatsApp}
              </Box>
            </Button>

            <LinkPanel
              label={copy.eventCreated.organizerLinkLabel}
              help={copy.eventCreated.organizerLinkHelp}
              url={manageUrl}
              copyLabel={copy.share.copyOrganizerLink}
            />

            <Notice tone="warning" title={copy.eventCreated.warning} />
          </Stack>
        </Disclosure>

        {roster.promotable > 0 ? (
          <Notice tone="info" title={copy.manage.slotOpenedTitle}>
            {copy.manage.slotOpenedBody(roster.promotable)}
          </Notice>
        ) : null}

        {/* Confirmed payments that no longer match the computed share. Never
            reconciled automatically — the organizer sorts it out in person. */}
        {roster.discrepancies.map((discrepancy) => (
          <Notice
            key={discrepancy.participantId}
            tone="warning"
            title={copy.manage.splitWarningTitle}
          >
            {copy.manage.splitWarningBody(
              nameOf(discrepancy.participantId),
              formatMoney(discrepancy.confirmedAmountMinor, event.currency),
              formatMoney(discrepancy.computedAmountMinor, event.currency),
            )}
          </Notice>
        ))}

        <Divider />

        <MoneySummary roster={roster} />

        {showMoney ? <Divider /> : null}

        <Stack gap="5">
          {roster.members.length === 0 ? (
            <Notice tone="info" title={copy.manage.noParticipants}>
              {copy.manage.noParticipantsHelp}
            </Notice>
          ) : (
            <>
              <RosterGroup
                title={copy.roster.inTitle}
                members={roster.attending}
                currency={event.currency}
                showMoney={showMoney}
                renderActions={(member) => (
                  <>
                    {showMoney ? (
                      <PaymentControls
                        publicToken={publicToken}
                        organizerToken={organizerToken}
                        participantId={member.id}
                        displayName={member.displayName}
                        status={member.share.status}
                      />
                    ) : null}
                    <RemoveControl
                      publicToken={publicToken}
                      organizerToken={organizerToken}
                      participantId={member.id}
                      displayName={member.displayName}
                    />
                  </>
                )}
              />

              {roster.waitlisted.length > 0 ? (
                <RosterGroup
                  title={copy.roster.waitlistedTitle}
                  members={roster.waitlisted}
                  currency={event.currency}
                  showMoney={false}
                  numbered
                  renderActions={(member) => (
                    <>
                      <PromoteControl
                        publicToken={publicToken}
                        organizerToken={organizerToken}
                        participantId={member.id}
                        displayName={member.displayName}
                      />
                      <RemoveControl
                        publicToken={publicToken}
                        organizerToken={organizerToken}
                        participantId={member.id}
                        displayName={member.displayName}
                      />
                    </>
                  )}
                />
              ) : null}

              {roster.maybe.length > 0 ? (
                <RosterGroup
                  title={copy.roster.maybeTitle}
                  members={roster.maybe}
                  currency={event.currency}
                  showMoney={false}
                  renderActions={(member) => (
                    <RemoveControl
                      publicToken={publicToken}
                      organizerToken={organizerToken}
                      participantId={member.id}
                      displayName={member.displayName}
                    />
                  )}
                />
              ) : null}

              {roster.notAttending.length > 0 ? (
                <RosterGroup
                  title={copy.roster.outTitle}
                  members={roster.notAttending}
                  currency={event.currency}
                  showMoney={false}
                  renderActions={(member) => (
                    <RemoveControl
                      publicToken={publicToken}
                      organizerToken={organizerToken}
                      participantId={member.id}
                      displayName={member.displayName}
                    />
                  )}
                />
              ) : null}
            </>
          )}

          <Disclosure id="add" label={copy.manage.addParticipant}>
            <AddParticipantForm publicToken={publicToken} organizerToken={organizerToken} />
          </Disclosure>
        </Stack>

        <Disclosure id="edit" label={copy.manage.editEvent}>
          <EditEventForm publicToken={publicToken} organizerToken={organizerToken} event={event} />
        </Disclosure>

        {/* Closing is deliberately last and low-key: it is the end of the
            event's life, not something to reach for by accident. */}
        <CloseEventControl
          publicToken={publicToken}
          organizerToken={organizerToken}
          isClosed={event.isClosed}
        />
      </Stack>
    </Container>
  );
}
