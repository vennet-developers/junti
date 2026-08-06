import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Box, Container, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Banner } from "@stackmyth/banner";
import { InfoIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { CreatedToast } from "@/components/created-toast";
import { Disclosure } from "@/components/disclosure";
import { EventHeader } from "@/components/event-header";
import { Link } from "@/components/link";
import { LinkPanel } from "@/components/link-panel";
import { MoneySummary } from "@/components/money-summary";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { RosterGroup } from "@/components/roster-list";
import { getCopy } from "@/config/copy";
import { formatMoney as formatMoneyLocal } from "@/lib/format";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, signInPath } from "@/config/routes";
import { managePath, participantPath, whatsAppContactUrl, whatsAppShareUrl } from "@/lib/paths";
import type { ParticipantRosterMember, RosterView } from "@/lib/roster";

import { CommitmentNote } from "../../-commitment-note";
import { CancelEventControl, CloseEventControl } from "./-close-event-control";
import { InviteForm, InvitedList } from "./-invite-panel";
import { EditEventForm } from "./-manage-forms";
import { PaymentControls, PromoteControl, RemoveControl } from "./-participant-controls";
import { ReviewQueue, type ReviewItem } from "./-review-queue";

/**
 * The organizer view — the port of the manage page.
 *
 * Reached only with both tokens; every mutation re-checks the pair
 * server-side, so being on this page is not itself proof of anything. The
 * loader assembles everything the async page assembled, flattening the two
 * structures that do not cross the wire: the compliance map becomes
 * ready-made note strings, and the contacts map a plain record.
 */
const getManagePage = createServerFn({ method: "GET" })
  .validator((data: { publicToken: string; organizerToken: string }) => data)
  .handler(async ({ data }) => {
    const [
      { getCopy: getCopyOnServer },
      { resolveEventLocale },
      { readingTimeZone, resolvePreferences, loadShareTemplate },
      { getOrganizer },
      roster_,
      { loadCommitments },
      { loadAllEventTypes, loadPolicyOptionsByEventType },
      { shortEventTime },
      { renderShareMessage },
      { formatEventDateTimeShort },
      { origin },
    ] = await Promise.all([
      import("@/config/copy"),
      import("@/lib/locale"),
      import("@/lib/preferences"),
      import("@/lib/organizer"),
      import("@/lib/roster"),
      import("@/lib/commitments"),
      import("@/lib/catalog"),
      import("@/lib/event-time"),
      import("@/lib/share-message"),
      import("@/lib/format"),
      import("@/lib/urls"),
    ]);

    const organizer = await getOrganizer();

    // Sign in rather than 404: somebody arriving on a manage link they were
    // sent is in the right place and simply has no session yet.
    if (!organizer) {
      throw redirect({
        to: signInPath(managePath(data.publicToken, data.organizerToken)) as never,
      });
    }

    const eventRow = await roster_.authorizeOrganizer(
      data.publicToken,
      data.organizerToken,
      organizer.id,
    );
    if (!eventRow) throw notFound();

    const locale = await resolveEventLocale(eventRow.locale);
    const copy = getCopyOnServer(locale);

    const { timeZone: preferredTimeZone } = await resolvePreferences();
    const readerTimeZone = readingTimeZone(preferredTimeZone, eventRow.timeZone);

    // Editing needs the owning account, not merely the manage link: a
    // co-organizer can run the day but cannot rewrite what the event IS.
    const canEdit = organizer.id === eventRow.organizerId;

    const roster = await roster_.loadRoster(eventRow, locale);
    const queue = await roster_.loadReviewQueue(eventRow.id, locale);

    // Organizer-only, and the two reads on this page that return contact
    // details. Neither goes anywhere near what the public page uses.
    const invitations = await roster_.loadInvitations(eventRow.id);

    /*
      The group is what the invite panel picks from. Loaded here rather than in
      the component because the membership check that makes an invitation
      legitimate happens on the server, and the panel should show exactly the
      people that check would let through — not a superset it discovers on
      submit.
    */
    const { loadEventGroup } = await import("@/lib/groups");
    const { invitableMembers } = await import("@/domain/groups");
    const eventGroup = await loadEventGroup(eventRow.id);

    // The editor's own groups, for the attach control. A co-organizer running
    // the day by link owns none, and gets an empty list rather than a lie.
    const { loadOwnedGroups } = await import("@/lib/groups");
    const ownedGroups = await loadOwnedGroups(organizer.id);
    const invitedIds = new Set(invitations.map((row) => row.userId));
    const groupMembers = eventGroup
      ? invitableMembers(eventGroup.members).map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          invited: invitedIds.has(member.userId),
        }))
      : [];
    const contactsMap = await roster_.loadParticipantContacts(eventRow.id);
    const contacts: Record<string, string> = Object.fromEntries(contactsMap);

    const commitments = await loadCommitments(eventRow.id);

    // The catalogue: what is on offer plus this event's own kind if retired.
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
      submittedAt: formatEventDateTimeShort(item.createdAt, eventRow.timeZone, copy.intlLocale),
      hasEvidence: item.hasEvidence,
      evidenceUrl: `${managePath(data.publicToken, data.organizerToken)}/evidence/${item.id}`,
    }));

    const base = await origin();
    const participantUrl = `${base}${participantPath(data.publicToken)}`;
    const manageUrl = `${base}${managePath(data.publicToken, data.organizerToken)}`;

    const shareMessage = renderShareMessage(
      await loadShareTemplate(eventRow.organizerId, copy.share.defaultMessage),
      {
        title: roster.event.title,
        when: shortEventTime(roster.event.startsAt, roster.event.timeZone, copy),
        link: participantUrl,
      },
    );

    // "Waiting on: …" strings, flattened from the compliance map.
    const pendingNotes: Record<string, string> = {};
    for (const member of roster.pendingPolicy) {
      const compliance = roster.compliance.get(member.id);
      if (!compliance || compliance.blocking.length === 0) continue;

      const labels = compliance.blocking.map((policy) => policy.label).join(", ");
      const allSubmitted = compliance.awaitingReview.length === compliance.blocking.length;
      pendingNotes[member.id] = allSubmitted
        ? copy.roster.inReview(labels)
        : copy.roster.waitingOn(labels);
    }

    return {
      title: copy.manage.title,
      locale,
      readerTimeZone,
      canEdit,
      contacts,
      pendingNotes,
      invitations,
      group: eventGroup ? { id: eventGroup.id, name: eventGroup.name } : null,
      groupMembers,
      ownedGroups: ownedGroups.map((group) => ({ id: group.id, name: group.name })),
      reviewItems,
      participantUrl,
      manageUrl,
      shareMessage,
      eventTypes,
      policyOptionsByType,
      commitments: commitments.map((item) => ({
        id: item.id,
        participantId: item.participantId,
        note: item.note,
        reaction: item.reaction,
      })),
      policies: roster.policies.map((policy) => ({
        id: policy.id,
        definitionId: policy.definitionId,
        label: policy.labelOverride,
        description: policy.descriptionOverride,
      })),
      roster: { ...roster, compliance: undefined } as unknown as Omit<RosterView, "compliance">,
    };
  });

export const Route = createFileRoute("/e/$public_token/manage/$organizer_token/")({
  validateSearch: (search: Record<string, unknown>): { created?: string } => ({
    created: typeof search.created === "string" ? search.created : undefined,
  }),
  loader: ({ params }) =>
    getManagePage({
      data: { publicToken: params.public_token, organizerToken: params.organizer_token },
    }),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { public_token: publicToken, organizer_token: organizerToken } = Route.useParams();
  const { created } = Route.useSearch();
  const {
    locale,
    readerTimeZone,
    canEdit,
    contacts,
    pendingNotes,
    invitations,
    group,
    groupMembers,
    ownedGroups,
    reviewItems,
    participantUrl,
    manageUrl,
    shareMessage,
    eventTypes,
    policyOptionsByType,
    commitments,
    policies,
    roster,
  } = Route.useLoaderData();

  const copy = getCopy(locale);
  const { event } = roster;

  const justCreated = created === "1";
  const showMoney = event.hasCost;

  const commitmentByParticipant = new Map(commitments.map((item) => [item.participantId, item]));

  const nameOf = (participantId: string) =>
    roster.members.find((m) => m.id === participantId)?.displayName ?? "";

  /** Just the commitment, for groups whose note slot is already spoken for. */
  const commitmentNote = (member: ParticipantRosterMember) => {
    const commitment = commitmentByParticipant.get(member.id);
    if (!commitment) return null;

    return (
      <CommitmentNote
        publicToken={publicToken}
        noteId={commitment.id}
        note={commitment.note}
        reaction={commitment.reaction}
        authorName={member.displayName}
        canDelete={canEdit}
      />
    );
  };

  /** What a pending participant still owes the event. */
  const pendingNote = (member: ParticipantRosterMember) => {
    const text = pendingNotes[member.id];
    if (!text) return null;

    return (
      <Stack gap="1">
        <Text variant="small" color="muted">
          {text}
        </Text>
        {commitmentNote(member)}
      </Stack>
    );
  };

  /**
   * A way to reach this person, under their name — and what they said they
   * are bringing. The commitment matters more here than on the participant
   * page: the organizer is the one deciding whether to buy the ice.
   */
  const contactNote = (member: ParticipantRosterMember) => {
    const phone = contacts[member.id];
    const commitment = commitmentByParticipant.get(member.id);

    if (!phone && !commitment) return null;

    return (
      <Stack gap="1">
        {commitment ? commitmentNote(member) : null}

        {phone ? (
          <Text variant="small" color="muted">
            <Box as="a" href={whatsAppContactUrl(phone)} target="_blank" rel="noopener noreferrer">
              {phone}
            </Box>
          </Text>
        ) : null}
      </Stack>
    );
  };

  const participantActions = (member: ParticipantRosterMember) => (
    <>
      {/* The organizer console never gets a null share — it reads the full
          roster, not the participant projection — but the type it borrows
          allows one, and there is nothing to control without an amount. */}
      {showMoney && member.share ? (
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
    <Container size="4" px="4" py="6">
      <Stack gap="6">
        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[
            { label: copy.auth.myEventsLink, href: ROUTES.myEvents },
            { label: event.title, href: participantPath(publicToken) },
            { label: copy.nav.manage },
          ]}
        />

        {/*
          Two columns from `lg`, split at the event header: the record on the
          left, the tools on the right. DOM order is the phone's order. See
          the Next page's history for why the split starts here.
        */}
        <Grid columns={{ base: "1", lg: "1.7fr 1fr" }} gap="6" align="start">
          <Stack gap="6">
            <EventHeader
              event={event}
              attendingCount={roster.attending.reduce(
            (seats, member) => seats + 1 + member.guests.length,
            0,
          )}
              copy={copy}
              readerTimeZone={readerTimeZone}
              openSlots={roster.openSlots}
            />

            {justCreated ? (
              <>
                <CreatedToast />
                <Text color="muted">{copy.eventCreated.subheading}</Text>
              </>
            ) : null}

            {/* Expanded only right after creation, when the links ARE the task. */}
            <Disclosure id="share" label={copy.manage.shareSection} defaultOpen={justCreated}>
              <Stack gap="5">
                <LinkPanel
                  label={copy.eventCreated.participantLinkLabel}
                  help={copy.eventCreated.participantLinkHelp}
                  url={participantUrl}
                  copyLabel={copy.share.copyParticipantLink}
                />

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

                {/*
                  Under the link, before the WhatsApp button has been pressed.

                  This is the one moment the question is live: an organizer
                  about to send a link cannot otherwise see what the person
                  opening it runs into — their own session renders the page for
                  them, and the sign-in gate every invitee meets first is the
                  one screen they can never reach without a private window.
                */}
                <Stack gap="2">
                  <Stack gap="1">
                    <Text weight="semibold">{copy.event.preview.sectionLabel}</Text>
                    <Text variant="small" color="muted">
                      {copy.event.preview.sectionHelp}
                    </Text>
                  </Stack>
                  <Flex gap="2" wrap="wrap">
                    <Button asChild variant="secondary" size="md">
                      <Link href={participantPath(publicToken)} search={{ as: "guest" }}>
                        {copy.event.preview.asGuest}
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" size="md">
                      <Link href={participantPath(publicToken)} search={{ as: "stranger" }}>
                        {copy.event.preview.asStranger}
                      </Link>
                    </Button>
                  </Flex>
                </Stack>

                <LinkPanel
                  label={copy.eventCreated.organizerLinkLabel}
                  help={copy.eventCreated.organizerLinkHelp}
                  url={manageUrl}
                  copyLabel={copy.share.copyOrganizerLink}
                />

                <Banner variant="info" live="off" icon={<InfoIcon size={18} aria-hidden="true" />} title={copy.eventCreated.organizerLinkNote} />
              </Stack>
            </Disclosure>

            {roster.promotable > 0 ? (
              <Banner variant="info" live="off" icon={<InfoIcon size={18} aria-hidden="true" />} title={copy.manage.slotOpenedTitle}>
                {copy.manage.slotOpenedBody(roster.promotable)}
              </Banner>
            ) : null}

            {/* Above the money and the roster, because it is the only thing
                on this page somebody else is actively waiting on. */}
            {policies.length > 0 ? (
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
              <Banner
                key={discrepancy.participantId}
                variant="warning" live="off" icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
                title={copy.manage.splitWarningTitle}
              >
                {copy.manage.splitWarningBody(
                  nameOf(discrepancy.participantId),
                  formatMoneyLocal(discrepancy.confirmedAmountMinor, event.currency, copy.intlLocale),
                  formatMoneyLocal(discrepancy.computedAmountMinor, event.currency, copy.intlLocale),
                )}
              </Banner>
            ))}

            <Divider />

            <MoneySummary roster={roster as never} copy={copy} />

            {showMoney ? <Divider /> : null}

            <Stack gap="5">
              <RosterHeading copy={copy} count={roster.confirmed.length} />

              {roster.members.length === 0 ? (
                <Banner variant="info" live="off" icon={<InfoIcon size={18} aria-hidden="true" />} title={copy.manage.noParticipants}>
                  {copy.manage.noParticipantsHelp}
                </Banner>
              ) : (
                <>
                  <RosterGroup
                    showHeading={false}
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
                        {/* No heading: the disclosure above already says it. */}
                        <RosterGroup
                          title={copy.roster.pendingPolicyTitle}
                          members={roster.pendingPolicy}
                          currency={event.currency}
                          copy={copy}
                          showMoney={showMoney}
                          showHeading={false}
                          renderNote={pendingNote}
                          renderActions={participantActions}
                        />
                      </Stack>
                    </Disclosure>
                  ) : null}

                  {roster.waitlisted.length > 0 ? (
                    <RosterGroup
                      headingSize="label"
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
                      headingSize="label"
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
                      headingSize="label"
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

          {/* The aside: everything here is something you do; everything in
              the column beside it is something that happened. */}
          <Stack gap="6">
            <Disclosure id="invite" label={copy.invites.heading}>
              <Stack gap="5">
                <InviteForm
                  publicToken={publicToken}
                  organizerToken={organizerToken}
                  group={group}
                  members={groupMembers}
                />

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
                  policies={policies}
                  eventTypes={eventTypes}
                  groups={ownedGroups}
                  policyOptionsByType={policyOptionsByType}
                  collectedMinor={roster.collectedMinor}
                />
              ) : (
                <Banner variant="info" live="off" icon={<InfoIcon size={18} aria-hidden="true" />} title={copy.manage.editNotYours} />
              )}
            </Disclosure>

            {/* Closing is deliberately last and low-key. */}
            {/* Cancelling sits under closing and reads quieter, because the
                two are one misread apart and only one of them can be undone. */}
            {event.isCancelled ? null : (
              <Stack gap="2">
                <Text variant="small" weight="semibold">
                  {copy.manage.cancelHeading}
                </Text>
                <Text variant="small" color="muted">
                  {copy.manage.cancelHelp}
                </Text>
                <Flex>
                  <CancelEventControl
                    publicToken={publicToken}
                    organizerToken={organizerToken}
                    title={event.title}
                  />
                </Flex>
              </Stack>
            )}

            <CloseEventControl
              publicToken={publicToken}
              organizerToken={organizerToken}
              isClosed={event.isClosed}
            />
          </Stack>
        </Grid>
      </Stack>
    </Container>
  );
}

/** "Vienen" + the count in a pill — same rank as "Cuentas" beside it. */
function RosterHeading({ copy, count }: { copy: ReturnType<typeof getCopy>; count: number }) {
  return (
    <Flex justify="between" align="center" gap="3">
      <Text variant="h3" fontFamily="var(--junti-display)">
        {copy.roster.inTitle}
      </Text>
      <Badge variant="secondary" size="md" soft>
        {count}
      </Badge>
    </Flex>
  );
}
