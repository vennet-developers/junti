import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Box, Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Banner } from "@stackmyth/banner";
import { CalendarIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Disclosure } from "@/components/disclosure";
import { EventHeader } from "@/components/event-header";
import { LiveEvent } from "@/components/live-event";
import { MoneySummary } from "@/components/money-summary";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { RsvpCountdown, useConvocation } from "@/components/rsvp-countdown";
import { RosterGroup } from "@/components/roster-list";
import { TimeZoneSync } from "@/components/time-zone-sync";
import { TrackView } from "@/components/track-view";
import { getCopy } from "@/config/copy";
import { pageTitle } from "@/lib/page-title";
import { ROUTES } from "@/config/routes";
import { canDeleteCommitment } from "@/domain/commitments";
import { effectivePreviewMode, parsePreviewMode, previewReader } from "@/domain/preview";
import { participantPath } from "@/lib/paths";
import type { ParticipantRosterMember } from "@/lib/roster";

import { CommitmentNote } from "./-commitment-note";
import { GatedPreview } from "./-gated-preview";
import { JoinWizard } from "./-join-wizard";
import { type PolicyPanelItem } from "./-policy-panel";
import { PreviewBar } from "./-preview-bar";
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
  .validator((data: { publicToken: string; as?: string }) => data)
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
      Whose eyes this page is being read through.

      Narrowed here rather than in the component on purpose: an organizer
      checking "does a stranger see the phone numbers" deserves an answer about
      what actually crosses the wire, not about what the browser chose to
      paint. So a preview removes the fields from the payload, and the HTML a
      stranger would receive is the HTML this returns.
    */
    const preview = effectivePreviewMode({
      requested: parsePreviewMode(data.as),
      isOwner: organizer !== null && eventRow.organizerId === organizer.id,
    });

    const reader = previewReader(
      { signedIn: organizer !== null, ownStake: true },
      preview,
    );

    /*
      This reader's own row, matched on the account and only on the account —
      the edit-token cookie path died with the anonymous flow.

      Skipped entirely while previewing, which is what makes the rest fall away
      with it: `ownCommitment` and `myPolicies` both hang off this row, so one
      condition removes the reader's whole stake instead of three that could
      drift apart.
    */
    const mineRow = organizer && reader.ownStake
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

    /*
      The sponsor's own held spots, WITH claim tokens. This is the only place
      tokens travel: the roster's copies are stripped in the projection, so a
      seat held for Pedro cannot be claimed by whoever else opens the page.
    */
    const { defaultGuestName } = await import("@/domain/held-spots");
    const myGuests =
      mineRow && reader.ownStake
        ? (await roster_.loadHeldSpots(eventRow.id))
            .filter((spot) => spot.sponsorParticipantId === mineRow.id)
            .map((spot, index) => ({
              id: spot.id,
              name: spot.guestName ?? defaultGuestName(mineRow.displayName, index + 1),
              claimToken: spot.claimToken,
              claimed: spot.claimedBy !== null,
            }))
        : [];
    const { getSetting } = await import("@/lib/settings");
    const maxHeldSpots = await getSetting("maxHeldSpots");

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
      /*
        The clock this page was rendered on, so the countdown's first paint is
        the same on the server and on hydration. The browser's own clock takes
        over immediately after mount — see `useConvocation`.
      */
      serverNow: new Date(),
      /*
        The mode in force, for the bar that says so. Null for everybody who is
        not the owner previewing, which is everybody almost all of the time.
      */
      preview,
      signedIn: reader.signedIn,
      account:
        organizer && reader.signedIn
          ? { displayName: organizer.displayName, avatarUrl: organizer.avatarUrl }
          : null,
      /*
        False while previewing, and that is not cosmetic: it is what decides
        whether the reader may delete somebody else's commitment note. An
        organizer looking through an invitee's eyes should not be offered a
        power the invitee does not have.
      */
      readerIsOrganizer:
        preview === null && organizer !== null && eventRow.organizerId === organizer.id,
      mine: mineRow ? { displayName: mineRow.displayName, attendance: mineRow.attendance } : null,
      mineId: mineRow?.id ?? null,
      ownCommitment: ownCommitment
        ? { id: ownCommitment.id, note: ownCommitment.note, reaction: ownCommitment.reaction }
        : null,
      myPolicies,
      myGuests,
      maxHeldSpots,
      pendingNotes,
      /*
        Only notes whose author is CONFIRMED, when the event has requirements
        — Ivan's step 3: the message is written any time but published once
        its author counts. Absent from the payload, not hidden in the
        component, same reasoning as the projection below.
      */
      commitments: commitments
        .filter(
          (item) =>
            roster.policies.length === 0 ||
            roster.confirmed.some((member) => member.id === item.participantId),
        )
        .map((item) => ({
          id: item.id,
          participantId: item.participantId,
          note: item.note,
          reaction: item.reaction,
        })),
      /*
        The participant projection, not the full view.

        This used to be `{ ...roster, compliance: undefined }` with a cast —
        the compliance Map was removed because it does not serialise, and
        everything else came along because nothing stopped it. What came along
        was `pendingReview`, `promotable`, `discrepancies` and an account id per
        member: four things only the organizer console renders, sitting in the
        HTML of every reader's page including a signed-out one.

        Nothing was displaying them, which is exactly the point the card makes —
        "absent for participants, not merely hidden". `toParticipantView` is
        where absent is enforced, and the cast is gone with it, so adding an
        organizer-only field to `RosterView` from now on does not silently
        arrive here.
      */
      /*
        The reader, not the request: `reader.signedIn` is the value after any
        preview narrowing, so a stranger preview drops the money exactly as a
        real stranger's page does. That is the point of narrowing in the loader
        rather than in the component.
      */
      roster: roster_.toParticipantView(roster, { signedIn: reader.signedIn }),
    };
  });

export const Route = createFileRoute("/e/$public_token/")({
  /*
    `?as=` is how an organizer borrows somebody else's eyes — see
    `src/domain/preview.ts`. Kept as a search param rather than a separate
    route because it is the same page: a preview that rendered from different
    code would stop being evidence of anything.
  */
  validateSearch: (search: Record<string, unknown>): { as?: string } => ({
    as: typeof search.as === "string" ? search.as : undefined,
  }),
  // In the deps, so switching modes re-runs the loader instead of showing the
  // previous mode's payload under the new mode's banner.
  loaderDeps: ({ search }) => ({ as: search.as }),
  loader: ({ params, deps }) =>
    getEventPage({ data: { publicToken: params.public_token, as: deps.as } }),
  head: ({ loaderData }) => ({
    // These URLs are the access control. They must never be indexed.
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ParticipantPage,
});

/**
 * What the Pago tab asks for: the CONVOCATORIA's quota, per seat.
 *
 * A total-mode event with a capacity was planned as "total entre N cupos" —
 * $260.000 entre 10 es $26.000 por cabeza — and that is the number a person
 * transfers when they confirm, times the seats they answer for. It is NOT
 * today's split among whoever has confirmed so far: that number starts at
 * the full total for the first person in and shrinks with each arrival,
 * which Ivan read (twice) as the app charging him the event. The living
 * split stays where it belongs — the roster below and Cuentas finales — and
 * any gap between quotas paid and the real split is exactly what the
 * settlement card reconciles after the fact.
 *
 * Per-person mode's computed share already IS the quota; a total-mode event
 * without a capacity has no planned denominator, so today's split is the
 * only honest number left.
 */
function quotaFor(
  event: { costMode: string; costAmountMinor: number | null; capacity: number | null },
  units: number,
  computedShareMinor: number | null,
): number | null {
  if (event.costMode === "total" && event.capacity && event.costAmountMinor) {
    return Math.round((event.costAmountMinor * units) / event.capacity);
  }
  return computedShareMinor;
}

function ParticipantPage() {
  const { public_token: publicToken } = Route.useParams();
  const {
    locale,
    readerTimeZone,
    hasTimeZonePreference,
    serverNow,
    preview,
    signedIn,
    account,
    readerIsOrganizer,
    mine,
    mineId,
    ownCommitment,
    myPolicies,
    myGuests,
    maxHeldSpots,
    pendingNotes,
    commitments,
    roster,
  } = Route.useLoaderData();

  // Event-resolved copy, not the provider's: the provider follows the viewer,
  // and this page defers to the event's language when the viewer never chose.
  const copy = getCopy(locale);

  const { event } = roster;
  /*
    Costs are for the people in on it. A signed-out reader was never sent the
    amounts — `toParticipantView` nulls them — and this keeps the component in
    step with the payload rather than trusting one of the two.
  */
  const showMoney = event.hasCost && signedIn;

  /*
    Whether this event is taking answers, on the reader's own clock rather than
    on the one the loader ran against. Everything below that shows or hides a
    way to answer reads this, so the page cannot end up offering a form the
    server would refuse — see the hook for how it closes in front of somebody
    who has had the page open since yesterday.
  */
  const convocation = useConvocation(event, serverNow);
  const answersOpen = convocation.state === "open";

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
  const pendingNote = (member: ParticipantRosterMember) => {
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
  /*
    Whether being ON the confirmed list already means "paid": true exactly
    when a proof_of_payment policy gates confirmation, because approving the
    receipt records the money. On such an event the per-row "Pagó" pill is
    the group restating its own definition — muted below, so the pills that
    remain are the exceptions worth a glance.
  */
  const paymentGated =
    showMoney && roster.policies.some((policy) => policy.slug === "proof_of_payment");

  const eventTail = (
    <Stack gap="6">
      <Divider />

      {showMoney ? <MoneySummary roster={roster} copy={copy} /> : null}

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
              mutePaymentStatus={paymentGated ? "confirmed" : undefined}
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
                    mutePaymentStatus={paymentGated ? "pending" : undefined}
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

        {/* Re-reads the loaders when anyone else changes this event — an
            approval, a claim, a dropout — so "Pendiente" becomes
            "Confirmado" without a refresh. */}
        <LiveEvent publicToken={publicToken} />

        {/* The top of the participant funnel. `signedIn` is the closest thing
            to "did they arrive from an invitation" that does not require a
            tracking parameter on the link.

            Not fired while previewing. An organizer checking their own page
            twice is not two people considering the event, and a funnel whose
            denominator counts rehearsals is worse than one that misses a
            visit — it flatters exactly the number it exists to keep honest. */}
        {preview === null ? (
          <TrackView name="event_viewed" props={{ event_id: event.id, signed_in: signedIn }} />
        ) : null}

        {/* Above everything, including the cancellation notice: an organizer
            has to know whose eyes they are using before they read anything
            through them. */}
        {preview === null ? null : (
          <PreviewBar mode={preview} publicToken={publicToken} copy={copy} />
        )}

        {/* Above everything, including the title. Somebody opening this link
            after the announcement needs the answer before the details. */}
        {event.isCancelled ? (
          <Banner
            variant="error"
            live="off"
            icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
            title={copy.manage.cancelledNotice}
          >
            {copy.manage.cancelledNoticeBody}
          </Banner>
        ) : null}

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
          attendingCount={roster.attending.reduce(
            (seats, member) => seats + 1 + member.guests.length,
            0,
          )}
          copy={copy}
          readerTimeZone={readerTimeZone}
          openSlots={roster.openSlots}
        />

        {/*
          The calendar file, on the page rather than only in an email.

          Most people arrive from a WhatsApp link and never get any email, so
          until this existed the calendar feature did not exist for the majority
          of participants. It is also the only thing that can produce the
          adoption number the Google Calendar card gates itself on — see the
          route's own note.

          A plain anchor, not a router link: the response is a download with a
          `Content-Disposition`, and asking the client router to navigate to it
          would be asking it to render a file.

          Hidden once the event is off. The route still serves a CANCEL for a
          bookmarked URL, which is right for a calendar that already holds the
          entry — but a button reading "add to my calendar" on an event that is
          not happening is an offer to do the wrong thing.
        */}
        {event.isCancelled ? null : (
          <Stack gap="1">
            <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
              <Button asChild variant="secondary" size="md" fullWidth>
                <a href={`${participantPath(event.publicToken)}/calendar.ics`} download>
                  <Flex gap="2" align="center" justify="center">
                    <CalendarIcon size={16} aria-hidden="true" />
                    {copy.event.addToCalendar}
                  </Flex>
                </a>
              </Button>
            </Box>
            <Text variant="small" color="muted">
              {copy.event.addToCalendarHelp}
            </Text>
          </Stack>
        )}

        {/* Above the box it applies to, and shown to a signed-out reader too:
            for them it is the reason to sign in now rather than tonight. */}
        {convocation.countdown ? (
          <RsvpCountdown
            countdown={convocation.countdown}
            readerTimeZone={readerTimeZone}
            copy={copy}
          />
        ) : null}

        {/* The RSVP box comes BEFORE the roster: answering is the point,
            who else is coming is merely interesting. */}
        {convocation.state === "cancelled" ? null : convocation.state === "closed" ? (
          <Banner variant="warning" live="off" icon={<TriangleAlertIcon size={18} aria-hidden="true" />} title={copy.event.closedNotice} />
        ) : convocation.state === "expired" ? (
          <Banner
            variant="warning"
            live="off"
            icon={<TriangleAlertIcon size={18} aria-hidden="true" />}
            title={copy.event.convocationClosedNotice}
          >
            {copy.event.convocationClosedBody}
          </Banner>
        ) : null}

        {/* The three tabs of taking part — answer, requirements, message —
            one wizard moment inside (a fresh "voy" on a gated event advances
            to the receipt), plain tabs every visit after. Still rendered once
            the convocation closes: the deadline settles the headcount, not
            the receipt — see `stopped` against `answersClosed`. */}
        {!event.isCancelled && signedIn && account && (answersOpen || mineId) ? (
          <JoinWizard
            join={{
              publicToken,
              mine,
              isFull: roster.openSlots !== null && roster.openSlots === 0,
              account,
              refund:
                event.hasCost && event.refundNoticeHours !== null
                  ? { hours: event.refundNoticeHours, startsAt: event.startsAt }
                  : null,
              guests:
                maxHeldSpots - myGuests.filter((g) => !g.claimed).length > 0
                  ? { remaining: maxHeldSpots - myGuests.filter((g) => !g.claimed).length }
                  : null,
            }}
            policies={myPolicies}
            hasPolicies={roster.policies.length > 0}
            commitment={{ own: ownCommitment }}
            guestsHeld={myGuests}
            shareMinor={
              mineId
                ? quotaFor(
                    event,
                    1 + myGuests.filter((guest) => !guest.claimed).length,
                    roster.members.find((member) => member.id === mineId)?.share
                      ?.computedAmountMinor ?? null,
                  )
                : null
            }
            currency={event.currency}
            answersOpen={answersOpen && !event.isClosed}
            attendance={mine?.attendance ?? null}
          />
        ) : null}

        {/* For a signed-out reader the rest is the teaser with the card on
            top. Somebody who can act on these numbers reads them plainly. */}
        {signedIn || !answersOpen ? (
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
