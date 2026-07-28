import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@stackmyth/button";
import { Box, Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { EventHeader } from "@/components/event-header";
import { LinkPanel } from "@/components/link-panel";
import { MoneySummary } from "@/components/money-summary";
import { Disclosure } from "@/components/disclosure";
import { Notice } from "@/components/notice";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RosterGroup } from "@/components/roster-list";
import { getCopy } from "@/config/copy";
import { loadEventTypes, loadPolicyOptionsByEventType } from "@/lib/catalog";
import { formatEventDateTimeShort, formatMoney } from "@/lib/format";
import { resolveEventLocale } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import {
  authorizeOrganizer,
  findEventByPublicToken,
  loadReviewQueue,
  loadRoster,
  type RosterMember,
} from "@/lib/roster";
import { managePath, origin, participantPath, whatsAppShareUrl } from "@/lib/urls";

import { CloseEventControl } from "./close-event-control";
import { AddParticipantForm, EditEventForm } from "./manage-forms";
import { PaymentControls, PromoteControl, RemoveControl } from "./participant-controls";
import { ReviewQueue, type ReviewItem } from "./review-queue";

/**
 * The organizer view.
 *
 * Reached only with both tokens. Everything the participant page shows, plus
 * the controls. Every mutation re-checks the token pair server-side — being on
 * this page is not itself proof of anything.
 */

type Params = { public_token: string; organizer_token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  // Reads the event so the tab title is in the same language as the page.
  // Only the public token is needed, and it grants nothing on its own.
  const { public_token: publicToken } = await params;
  const event = await findEventByPublicToken(publicToken);
  const copy = getCopy(await resolveEventLocale(event?.locale ?? "es"));

  return {
    title: copy.manage.title,
    robots: { index: false, follow: false },
  };
}

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

  const locale = await resolveEventLocale(eventRow.locale);
  const copy = getCopy(locale);

  const roster = await loadRoster(eventRow, locale);
  const { event } = roster;

  const queue = await loadReviewQueue(eventRow.id, locale);

  // The catalogue, for the edit form's kind picker and policy list.
  const [eventTypes, policyOptionsByType] = await Promise.all([
    loadEventTypes(locale),
    loadPolicyOptionsByEventType(locale),
  ]);

  const reviewItems: ReviewItem[] = queue.map((item) => ({
    id: item.id,
    participantName: item.participantName,
    policyLabel: item.policyLabel,
    note: item.note,
    submittedAt: formatEventDateTimeShort(item.createdAt, event.timeZone, copy.intlLocale),
    hasEvidence: item.hasEvidence,
    // Under the organizer path, so the token in the URL is what authorises it.
    evidenceUrl: `${managePath(publicToken, organizerToken)}/evidence/${item.id}`,
  }));

  const base = await origin();
  const participantUrl = `${base}${participantPath(publicToken)}`;
  const manageUrl = `${base}${managePath(publicToken, organizerToken)}`;

  const shareMessage = copy.share.whatsAppMessage(
    event.title,
    formatEventDateTimeShort(event.startsAt, event.timeZone, copy.intlLocale),
    participantUrl,
  );

  const justCreated = created === "1";
  const showMoney = event.hasCost;

  const nameOf = (participantId: string) =>
    roster.members.find((m) => m.id === participantId)?.displayName ?? "";

  /** What a pending participant still owes the event. */
  const pendingNote = (member: RosterMember) => {
    const compliance = roster.compliance.get(member.id);
    if (!compliance || compliance.blocking.length === 0) return null;

    const labels = compliance.blocking.map((policy) => policy.label).join(", ");
    const allSubmitted = compliance.awaitingReview.length === compliance.blocking.length;

    return (
      <Text variant="small" color="muted">
        {allSubmitted ? copy.roster.inReview(labels) : copy.roster.waitingOn(labels)}
      </Text>
    );
  };

  const participantActions = (member: RosterMember) => (
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
  );

  return (
    <Container size="1">
      <Stack gap="6" py="6" px="4">
        {/* The event itself comes first. On a return visit that is what the
            organizer opened the page for; the links are one tap away below. */}
        <Flex justify="end">
          <LanguageSwitcher />
        </Flex>

        <EventHeader event={event} attendingCount={roster.attending.length} copy={copy} />

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
        {/* Above the money and the roster, because it is the only thing on this
            page that somebody else is actively waiting on. */}
        {roster.policies.length > 0 ? (
          <Disclosure
            id="review"
            label={
              reviewItems.length > 0
                ? `${copy.review.heading} · ${copy.review.pendingCount(reviewItems.length)}`
                : copy.review.heading
            }
            defaultOpen={reviewItems.length > 0}
          >
            <ReviewQueue
              publicToken={publicToken}
              organizerToken={organizerToken}
              items={reviewItems}
            />
          </Disclosure>
        ) : null}

        {roster.discrepancies.map((discrepancy) => (
          <Notice
            key={discrepancy.participantId}
            tone="warning"
            title={copy.manage.splitWarningTitle}
          >
            {copy.manage.splitWarningBody(
              nameOf(discrepancy.participantId),
              formatMoney(discrepancy.confirmedAmountMinor, event.currency, copy.intlLocale),
              formatMoney(discrepancy.computedAmountMinor, event.currency, copy.intlLocale),
            )}
          </Notice>
        ))}

        <Divider />

        <MoneySummary roster={roster} copy={copy} />

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
                members={roster.confirmed}
                currency={event.currency}
                copy={copy}
                showMoney={showMoney}
                renderActions={participantActions}
              />

              {roster.pendingPolicy.length > 0 ? (
                <Disclosure
                  id="pending-policy"
                  label={`${copy.roster.pendingPolicyTitle} (${roster.pendingPolicy.length})`}
                  defaultOpen
                >
                  <Stack gap="3">
                    <Text variant="small" color="muted">
                      {copy.roster.pendingPolicyHelp}
                    </Text>
                    <RosterGroup
                      title={copy.roster.pendingPolicyTitle}
                      members={roster.pendingPolicy}
                      currency={event.currency}
                      copy={copy}
                      showMoney={showMoney}
                      renderNote={pendingNote}
                      renderActions={participantActions}
                    />
                  </Stack>
                </Disclosure>
              ) : null}

              {roster.waitlisted.length > 0 ? (
                <RosterGroup
                  title={copy.roster.waitlistedTitle}
                  members={roster.waitlisted}
                  currency={event.currency}
                  copy={copy}
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
                  copy={copy}
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
                  copy={copy}
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
          <EditEventForm
            publicToken={publicToken}
            organizerToken={organizerToken}
            event={event}
            policies={roster.policies.map((policy) => ({
              id: policy.id,
              definitionId: policy.definitionId,
              /* Sent back as the override the organizer actually set, not the
                 resolved text — passing the resolved label would silently pin
                 every inherited policy to its current wording on first save. */
              label: policy.labelOverride,
              description: policy.descriptionOverride,
            }))}
            eventTypes={eventTypes}
            policyOptionsByType={policyOptionsByType}
          />
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
