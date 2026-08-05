import { Badge } from "@stackmyth/badge";
import { Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Banner } from "@stackmyth/banner";
import { TriangleAlertIcon } from "@stackmyth/icons";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Disclosure } from "@/components/disclosure";
import { EventHeader } from "@/components/event-header";
import { MoneySummary } from "@/components/money-summary";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { RosterGroup } from "@/components/roster-list";
import { TimeZoneSync } from "@/components/time-zone-sync";
import { TrackView } from "@/components/track-view";
import { getCopy } from "@/config/copy";
import { pageTitle } from "@/lib/page-title";
import { ROUTES } from "@/config/routes";
import { canDeleteCommitment } from "@/domain/commitments";
import type { RosterMember, RosterView } from "@/lib/roster";

import { CommitmentNote } from "./-commitment-note";
import { CommitmentPanel } from "./-commitment-panel";
import { GatedPreview } from "./-gated-preview";
import { JoinPanel } from "./-join-panel";
import { PolicyPanel, type PolicyPanelItem } from "./-policy-panel";
import { SignInToJoin } from "./-sign-in-to-join";

/**
 * The participant view — the port of `src/app/e/[public_token]/page.tsx`.
 *
 * Everything the async page computed now happens in this server function, and
 * the component below renders the same JSX from its result. The invariant the
 * page guarded carries over: the organizer token is never part of what this
 * loads — `loadRoster` returns an `EventView` with no such field, so it
 * cannot leak into the payload by accident.
 */
const getEventPage = createServerFn({ method: "GET" })
  .validator((data: { publicToken: string }) => data)
  .handler(async ({ data }) => {
    const [
      { getCopy: getCopyOnServer },
      { resolveEventLocale },
      { readingTimeZone, resolvePreferences },
      { getOrganizer },
      roster_,
      { loadCommitments, loadOwnCommitment },
      { db },
      { participants },
      { and, eq },
    ] = await Promise.all([
      import("@/config/copy"),
      import("@/lib/locale"),
      import("@/lib/preferences"),
      import("@/lib/organizer"),
      import("@/lib/roster"),
      import("@/lib/commitments"),
      import("@/db/client"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);

    const eventRow = await roster_.findEventByPublicToken(data.publicToken);
    if (!eventRow) throw notFound();

    // The event's language, unless the reader has chosen one for themselves.
    const locale = await resolveEventLocale(eventRow.locale);
    const copy = getCopyOnServer(locale);

    // The reader's zone when one is known, else the event's own.
    const { timeZone: preferredTimeZone } = await resolvePreferences();
    const readerTimeZone = readingTimeZone(preferredTimeZone, eventRow.timeZone);

    const roster = await roster_.loadRoster(eventRow, locale);
    const organizer = await getOrganizer();

    /*
      This reader's own row, matched on the account and only on the account —
      the edit-token cookie path died with the anonymous flow.
    */
    const mineRow = organizer
      ? ((
          await db
            .select({
              id: participants.id,
              displayName: participants.displayName,
              attendance: participants.attendance,
            })
            .from(participants)
            .where(
              and(eq(participants.eventId, eventRow.id), eq(participants.userId, organizer.id)),
            )
            .limit(1)
        )[0] ?? null)
      : null;

    /*
      The commitment feed, loaded with the page rather than fetched after
      mount: it is the reason somebody opens the link a second time.
    */
    const commitments = await loadCommitments(eventRow.id);
    const ownCommitment = mineRow ? await loadOwnCommitment(mineRow.id) : null;

    // What this person still owes the event. Only their own — never anyone
    // else's standing, which is the organizer's business.
    let myPolicies: PolicyPanelItem[] = [];

    if (mineRow && roster.policies.length > 0 && mineRow.attendance === "in") {
      const submissions = await roster_.loadParticipantSubmissions(mineRow.id, locale);
      const byPolicy = new Map(submissions.map((s) => [s.policyId, s]));

      myPolicies = roster.policies.map((policy) => {
        const submission = byPolicy.get(policy.id);
        return {
          id: policy.id,
          handler: policy.handler,
          label: policy.label,
          description: policy.description ?? null,
          state: submission?.status ?? "missing",
          reviewNote: submission?.reviewNote ?? null,
        };
      });
    }

    /*
      "Waiting on: receipt" under a pending person's name, precomputed here
      because the compliance map lives server-side. A plain record of final
      strings crosses the wire instead of the map.
    */
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
      title: roster.event.title,
      locale,
      readerTimeZone,
      hasTimeZonePreference: preferredTimeZone !== null,
      signedIn: organizer !== null,
      account: organizer
        ? { displayName: organizer.displayName, avatarUrl: organizer.avatarUrl }
        : null,
      readerIsOrganizer: organizer !== null && eventRow.organizerId === organizer.id,
      mine: mineRow ? { displayName: mineRow.displayName, attendance: mineRow.attendance } : null,
      mineId: mineRow?.id ?? null,
      ownCommitment: ownCommitment
        ? { id: ownCommitment.id, note: ownCommitment.note, reaction: ownCommitment.reaction }
        : null,
      myPolicies,
      pendingNotes,
      commitments: commitments.map((item) => ({
        id: item.id,
        participantId: item.participantId,
        note: item.note,
        reaction: item.reaction,
      })),
      /*
        The full roster view crosses the boundary minus its one map — Dates
        and arrays serialise, the compliance Map was flattened above into
        `pendingNotes`, which is all this page read from it.
      */
      roster: { ...roster, compliance: undefined } as unknown as Omit<RosterView, "compliance">,
    };
  });

export const Route = createFileRoute("/e/$public_token/")({
  loader: ({ params }) => getEventPage({ data: { publicToken: params.public_token } }),
  head: ({ loaderData }) => ({
    // These URLs are the access control. They must never be indexed.
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ParticipantPage,
});

function ParticipantPage() {
  const { public_token: publicToken } = Route.useParams();
  const {
    locale,
    readerTimeZone,
    hasTimeZonePreference,
    signedIn,
    account,
    readerIsOrganizer,
    mine,
    mineId,
    ownCommitment,
    myPolicies,
    pendingNotes,
    commitments,
    roster,
  } = Route.useLoaderData();

  // Event-resolved copy, not the provider's: the provider follows the viewer,
  // and this page defers to the event's language when the viewer never chose.
  const copy = getCopy(locale);

  const { event } = roster;
  const showMoney = event.hasCost;

  const commitmentByParticipant = new Map(commitments.map((item) => [item.participantId, item]));

  const commitmentNote = (member: { id: string; displayName: string }) => {
    const item = commitmentByParticipant.get(member.id);
    if (!item) return null;

    return (
      <CommitmentNote
        publicToken={publicToken}
        noteId={item.id}
        note={item.note}
        reaction={item.reaction}
        authorName={member.displayName}
        canDelete={canDeleteCommitment({
          authorParticipantId: item.participantId,
          readerParticipantId: mineId,
          readerIsOrganizer,
        })}
      />
    );
  };

  /** "Waiting on: receipt" under a pending person's name. */
  const pendingNote = (member: RosterMember) => {
    const text = pendingNotes[member.id];
    if (!text) return null;

    return (
      <Text variant="small" color="muted">
        {text}
      </Text>
    );
  };

  /**
   * The money and the roster — everything after the answer. One variable,
   * rendered in two frames: plainly for anyone who can act on it, and behind
   * {@link GatedPreview} for a signed-out reader. Writing it twice is how
   * the two drift.
   */
  const eventTail = (
    <Stack gap="6">
      <Divider />

      <MoneySummary roster={roster as never} copy={copy} />

      {showMoney ? <Divider /> : null}

      <Stack gap="5">
        {/* One heading, one count — see the Next page's history for the two
            headings this replaced. */}
        <Flex justify="between" align="center" gap="3">
          <Text variant="h3" fontFamily="var(--junti-display)">
            {copy.roster.heading}
          </Text>
          <Badge variant="secondary" size="md" soft>
            {roster.confirmed.length}
          </Badge>
        </Flex>

        {roster.members.length === 0 ? (
          <Text color="muted">{copy.roster.empty}</Text>
        ) : (
          <>
            {/* No caption: the heading above already names this list. The
                other groups keep theirs, because they need telling apart. */}
            <RosterGroup
              showHeading={false}
              title={copy.roster.inTitle}
              members={roster.confirmed}
              currency={event.currency}
              copy={copy}
              showMoney={showMoney}
              renderNote={commitmentNote}
            />

            {/* Collapsed, and below the confirmed list: present, and not the
                same thing as confirmed. */}
            {roster.pendingPolicy.length > 0 ? (
              <Disclosure
                id="pending-policy"
                label={`${copy.roster.pendingPolicyTitle} (${roster.pendingPolicy.length})`}
              >
                <Stack gap="3">
                  <Text variant="small" color="muted">
                    {copy.roster.pendingPolicyHelp}
                  </Text>
                  <RosterGroup
                    headingSize="label"
                    title={copy.roster.pendingPolicyTitle}
                    members={roster.pendingPolicy}
                    currency={event.currency}
                    copy={copy}
                    showMoney={showMoney}
                    renderNote={pendingNote}
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
              />
            ) : null}
          </>
        )}
      </Stack>
    </Stack>
  );

  return (
    /*
      A reading column, one step wider — `size="2"` because the formatted
      date is the densest single line in the product and 448px broke it. See
      the Next page for the measurement.
    */
    <Container size="2" px="4" py="6">
      <Stack gap="6">
        {/* Writes this device's zone into a cookie on a first visit, so the
            server renders every later paint on the right clock. */}
        <TimeZoneSync hasPreference={hasTimeZonePreference} />

        {/* The top of the participant funnel. `signedIn` is the closest thing
            to "did they arrive from an invitation" that does not require a
            tracking parameter on the link. */}
        <TrackView name="event_viewed" props={{ event_id: event.id, signed_in: signedIn }} />

        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[
            signedIn
              ? { label: copy.auth.myEventsLink, href: ROUTES.myEvents }
              : { label: copy.nav.home, href: ROUTES.home },
            { label: event.title },
          ]}
        />

        <EventHeader
          event={event}
          attendingCount={roster.attending.length}
          copy={copy}
          readerTimeZone={readerTimeZone}
          openSlots={roster.openSlots}
        />

        {/* The RSVP box comes BEFORE the roster: answering is the point,
            who else is coming is merely interesting. */}
        {event.isClosed ? (
          <Banner variant="warning" live="off" icon={<TriangleAlertIcon size={18} aria-hidden="true" />} title={copy.event.closedNotice} />
        ) : signedIn && account ? (
          <JoinPanel
            publicToken={publicToken}
            mine={mine}
            isFull={roster.openSlots !== null && roster.openSlots === 0}
            account={account}
          />
        ) : null}

        {/* Immediately under the answer — the rest of the same act. */}
        {!event.isClosed && myPolicies.length > 0 ? (
          <PolicyPanel publicToken={publicToken} items={myPolicies} />
        ) : null}

        {/* The sentence after "I'm in". Only for somebody on the roster. */}
        {!event.isClosed && mineId ? (
          <CommitmentPanel publicToken={publicToken} own={ownCommitment} />
        ) : null}

        {/* For a signed-out reader the rest is the teaser with the card on
            top. Somebody who can act on these numbers reads them plainly. */}
        {signedIn || event.isClosed ? (
          eventTail
        ) : (
          <GatedPreview
            card={
              <SignInToJoin
                publicToken={publicToken}
                copy={copy}
                eventTitle={event.title}
                attending={roster.attending.map((member) => ({
                  id: member.id,
                  displayName: member.displayName,
                  avatarUrl: member.avatarUrl,
                }))}
              />
            }
          >
            {eventTail}
          </GatedPreview>
        )}
      </Stack>
    </Container>
  );
}
