import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Button } from "@stackmyth/button";
import { Box, Container, Divider, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { EventHeader } from "@/components/event-header";
import { LinkPanel } from "@/components/link-panel";
import { MoneySummary } from "@/components/money-summary";
import { Disclosure } from "@/components/disclosure";
import { Notice } from "@/components/notice";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { RosterGroup } from "@/components/roster-list";
import { CreatedToast } from "@/components/created-toast";
import { getCopy } from "@/config/copy";
import { loadAllEventTypes, loadPolicyOptionsByEventType } from "@/lib/catalog";
import { shortEventTime } from "@/lib/event-time";
import { renderShareMessage } from "@/lib/share-message";
import { formatEventDateTimeShort, formatMoney } from "@/lib/format";
import { resolveEventLocale } from "@/lib/locale";
import { loadShareTemplate, readingTimeZone, resolvePreferences } from "@/lib/preferences";
import { getOrganizer } from "@/lib/organizer";
import { ROUTES, signInPath } from "@/config/routes";
import {
  authorizeOrganizer,
  loadInvitations,
  loadParticipantContacts,
  findEventByPublicToken,
  loadReviewQueue,
  loadRoster,
  type RosterMember,
} from "@/lib/roster";
import {
  managePath,
  origin,
  participantPath,
  whatsAppContactUrl,
  whatsAppShareUrl,
} from "@/lib/urls";

import { CloseEventControl } from "./close-event-control";
import { InviteForm, InvitedList } from "./invite-panel";
import { EditEventForm } from "./manage-forms";
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

  // Sign in rather than 404. Somebody arriving on a manage link they were sent
  // is in the right place and simply has no session yet — telling them the page
  // does not exist would be a lie they cannot act on.
  if (!organizer) redirect(signInPath(managePath(publicToken, organizerToken)));

  const eventRow = await authorizeOrganizer(publicToken, organizerToken, organizer.id);
  if (!eventRow) notFound();

  const locale = await resolveEventLocale(eventRow.locale);
  const copy = getCopy(locale);

  const { timeZone: preferredTimeZone } = await resolvePreferences();

  /**
   * Editing needs the owning account, not merely the manage link.
   *
   * Every event has an owner now, so the "this event has nobody to check
   * against" case is gone and this is one comparison. What remains is real: a
   * co-organizer holding the shared link can run the day — approve receipts,
   * mark payments, invite — but cannot rewrite what the event IS.
   */
  const canEdit = organizer?.id === eventRow.organizerId;
  const readerTimeZone = readingTimeZone(preferredTimeZone, eventRow.timeZone);

  const roster = await loadRoster(eventRow, locale);
  const { event } = roster;

  const queue = await loadReviewQueue(eventRow.id, locale);

  // Organizer-only, and the two reads on this page that return contact details.
  // Neither goes anywhere near `loadRoster`, whose result the public page uses.
  const invitations = await loadInvitations(eventRow.id);
  const contacts = await loadParticipantContacts(eventRow.id);

  // The catalogue, for the edit form's kind picker and policy list. The picker
  // shows what is on offer plus this event's own kind if it has since been
  // retired — retiring a kind must not evict the events that already have it,
  // and a picker missing the current value would silently reassign on save.
  const [allEventTypes, policyOptionsByType] = await Promise.all([
    loadAllEventTypes(locale),
    loadPolicyOptionsByEventType(locale),
  ]);
  const eventTypes = allEventTypes
    .filter((type) => type.isActive || type.id === eventRow.eventTypeId)
    .map((type) => ({ id: type.id, slug: type.slug, label: type.label }));

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

  // The organizer's message goes out in the EVENT's zone with the place named,
  // because it lands in a chat where somebody may be reading it from abroad.
  const shareMessage = renderShareMessage(
    await loadShareTemplate(eventRow.organizerId, copy.share.defaultMessage),
    {
      title: event.title,
      when: shortEventTime(event.startsAt, event.timeZone, copy),
      link: participantUrl,
    },
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

  /**
   * A way to reach this person, under their name.
   *
   * Only on the organizer's screen, and only for people who chose to give a
   * number — it is optional at onboarding and stays that way. Rendered as a
   * WhatsApp link rather than plain text because the reason an organizer is
   * looking at it is that they want to write to somebody, and a number they
   * have to copy is a number they will not use.
   */
  const contactNote = (member: RosterMember) => {
    const phone = contacts.get(member.id);
    if (!phone) return null;

    return (
      <Text variant="small" color="muted">
        <Box as="a" href={whatsAppContactUrl(phone)} target="_blank" rel="noopener noreferrer">
          {phone}
        </Box>
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
    <>
      <Container size="4" px="4" py="6">
        <Stack gap="6">
          {/*
            Three levels deep and reached by a secret link, so this is the
            screen the trail was worth building for. The middle crumb is the
            participant view of the same event — what the guests see — which
            is the one place an organizer actually wants to step out to.
          */}
          <PageBreadcrumb
            label={copy.nav.breadcrumbLabel}
            items={[
              organizer
                ? { label: copy.auth.myEventsLink, href: ROUTES.myEvents }
                : { label: copy.nav.home, href: ROUTES.home },
              { label: event.title, href: participantPath(publicToken) },
              { label: copy.nav.manage },
            ]}
          />

          {/* The event itself comes first. On a return visit that is what the
              organizer opened the page for; the links are one tap away below. */}
          <EventHeader
            event={event}
            attendingCount={roster.attending.length}
            copy={copy}
            readerTimeZone={readerTimeZone}
            openSlots={roster.openSlots}
          />

          {justCreated ? (
            <>
              {/* "Your event is created" floats — it is a fact about a moment.
                "Keep these two links" stays on the page, because losing them
                is unrecoverable and a message that expires cannot carry that. */}
              <CreatedToast />
              <Text color="muted">{copy.eventCreated.subheading}</Text>
            </>
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

              {/* The warning that used to sit here said losing this link meant
                losing the event, which was true when the token was the only
                identity there was. The event is in your history now; the link
                is for handing to somebody else. */}
              <Notice tone="info" title={copy.eventCreated.organizerLinkNote} />
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

          {/*
            Two columns from `lg`: the record on the left, the tools on the
            right.

            This is the densest screen in the product and the one an organizer
            opens at a desk. Everything above this line is context — which event,
            what is waiting on you — and stays full width because it is read once
            and applies to the whole page. Below it the page does two different
            jobs: the roster is the record of who answered and what they owe, and
            it is long; inviting, editing and closing are tools you reach for and
            put down, and they are short. Stacked, that meant scrolling past the
            entire roster to invite one more person.

            **The DOM order is the phone's order, unchanged.** No `order`
            juggling and no reordering to make the columns work: on a single
            column this renders money, roster, invite, edit, close — exactly the
            sequence it rendered before. The grid only decides where things sit
            once there is a second column to sit in, which is also why the share
            panel stayed above rather than moving into the aside. It opens
            expanded on a just-created event, and burying the links somebody was
            sent here to copy would be a regression on the one visit that matters
            most.

            `align="start"` so the aside keeps its own height instead of
            stretching to match a roster of forty people.
          */}
          <Grid columns={{ base: "1", lg: "1.7fr 1fr" }} gap="6" align="start">
            <Stack gap="6">
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
                      renderNote={contactNote}
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
              </Stack>
            </Stack>

            {/* The aside. Everything here is something you do; everything in the
                column beside it is something that happened. */}
            <Stack gap="6">
              {/* Inviting, where adding somebody by hand used to be. Beside the
                roster rather than under it now: that column is who answered,
                this is who was asked, and on a laptop the organizer can watch
                one fill as they work the other. */}
              <Disclosure id="invite" label={copy.invites.heading}>
                <Stack gap="5">
                  <InviteForm publicToken={publicToken} organizerToken={organizerToken} />

                  <Stack gap="2">
                    <Text variant="small" color="muted">
                      {copy.invites.listHelp}
                    </Text>
                    <InvitedList
                      publicToken={publicToken}
                      organizerToken={organizerToken}
                      invitations={invitations}
                      timeZone={readerTimeZone}
                    />
                  </Stack>
                </Stack>
              </Disclosure>

              <Disclosure id="edit" label={copy.manage.editEvent}>
                {canEdit ? (
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
                    collectedMinor={roster.collectedMinor}
                  />
                ) : (
                  /* Say why rather than showing nothing. An absent form reads as a
               bug; "this is not your event" is a fact about who owns it, and
               everything else on this page still works. */
                  <Notice tone="info" title={copy.manage.editNotYours} />
                )}
              </Disclosure>

              {/* Closing is deliberately last and low-key: it is the end of the
                event's life, not something to reach for by accident. */}
              <CloseEventControl
                publicToken={publicToken}
                organizerToken={organizerToken}
                isClosed={event.isClosed}
              />
            </Stack>
          </Grid>
        </Stack>
      </Container>
    </>
  );
}
