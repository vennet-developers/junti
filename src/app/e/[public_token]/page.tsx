import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Divider, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { Disclosure } from "@/components/disclosure";
import { EventHeader } from "@/components/event-header";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { MoneySummary } from "@/components/money-summary";
import { Notice } from "@/components/notice";
import { RosterGroup } from "@/components/roster-list";
import { TimeZoneSync } from "@/components/time-zone-sync";
import { getCopy } from "@/config/copy";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { resolveEventLocale } from "@/lib/locale";
import { readingTimeZone, resolvePreferences } from "@/lib/preferences";
import { getOrganizer } from "@/lib/organizer";
import {
  findEventByPublicToken,
  loadParticipantSubmissions,
  loadRoster,
  type RosterMember,
} from "@/lib/roster";
import { ROUTES } from "@/config/routes";
import { participantPath } from "@/lib/urls";
import { and, eq } from "drizzle-orm";

import { GatedPreview } from "./gated-preview";
import { JoinPanel } from "./join-panel";
import { PolicyPanel, type PolicyPanelItem } from "./policy-panel";
import { SignInToJoin } from "./sign-in-to-join";

/**
 * The participant view.
 *
 * Everything here is safe for anyone holding the public link. The organizer
 * token is never loaded into this component — `loadRoster` returns an
 * `EventView` that has no such field, so it cannot leak into the HTML or the
 * server-component payload by accident. The same goes for uploaded receipts:
 * they are reachable only through the organizer-only evidence route, and no
 * query on this page selects their bytes.
 */

type Params = { public_token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { public_token: publicToken } = await params;
  const event = await findEventByPublicToken(publicToken);
  const copy = getCopy(await resolveEventLocale(event?.locale ?? "es"));

  return {
    title: event ? event.title : copy.event.notFoundTitle,
    // These URLs are the access control. They must never be indexed.
    robots: { index: false, follow: false },
  };
}

export default async function ParticipantPage({ params }: { params: Promise<Params> }) {
  const { public_token: publicToken } = await params;

  const eventRow = await findEventByPublicToken(publicToken);
  if (!eventRow) notFound();

  // The event's language, unless the reader has chosen one for themselves.
  const locale = await resolveEventLocale(eventRow.locale);
  const copy = getCopy(locale);

  // The reader's zone when one is known, else the event's own.
  const { timeZone: preferredTimeZone, theme } = await resolvePreferences();
  const readerTimeZone = readingTimeZone(preferredTimeZone, eventRow.timeZone);

  const roster = await loadRoster(eventRow, locale);
  const organizer = await getOrganizer();

  /**
   * This reader's own row, if they have one.
   *
   * Matched on the account, and only on the account. There used to be a second
   * path here — an edit-token cookie written at RSVP time — from when answering
   * needed no account at all. It bought one thing, amending an RSVP from the
   * same browser, and cost the roster an identity that could not survive a new
   * phone or a cleared browser. Now that answering requires signing in, the
   * account is the identity everywhere and this is a single lookup.
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
          .where(and(eq(participants.eventId, eventRow.id), eq(participants.userId, organizer.id)))
          .limit(1)
      )[0] ?? null)
    : null;

  const mine = mineRow
    ? { displayName: mineRow.displayName, attendance: mineRow.attendance }
    : null;

  // What this person still owes the event, if anything. Only their own — never
  // anyone else's standing, which is the organizer's business.
  let myPolicies: PolicyPanelItem[] = [];

  if (mineRow && roster.policies.length > 0 && mineRow.attendance === "in") {
    const submissions = await loadParticipantSubmissions(mineRow.id, locale);
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

  const { event } = roster;
  const showMoney = event.hasCost;

  /** "Waiting on: receipt" under a pending person's name. */
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
   * The money and the roster — everything after the answer.
   *
   * Lifted into a variable because it is rendered in two frames: plainly for
   * anyone who can act on it, and behind {@link GatedPreview} for a signed-out
   * reader, where the sign-in card sits on top of it. Writing it twice is how
   * the two drift.
   */
  const eventTail = (
    <Stack gap="6">
      <Divider />

      <MoneySummary roster={roster} copy={copy} />

      {showMoney ? <Divider /> : null}

      <Stack gap="5">
        <Text variant="h3" fontFamily="var(--junti-display)">
          {copy.roster.heading}
        </Text>

        {roster.members.length === 0 ? (
          <Text color="muted">{copy.roster.empty}</Text>
        ) : (
          <>
            <RosterGroup
              title={copy.roster.inTitle}
              members={roster.confirmed}
              currency={event.currency}
              copy={copy}
              showMoney={showMoney}
            />

            {/*
              Collapsed, and below the confirmed list.

              These people said they are coming and still hold a spot — they
              are simply not confirmed yet. Putting them in the main list
              would overstate how many are certain; leaving them off the page
              would hide the fact that they are counted against capacity.
              Collapsed says both: present, and not the same thing.
            */}
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
                title={copy.roster.maybeTitle}
                members={roster.maybe}
                currency={event.currency}
                copy={copy}
                showMoney={false}
              />
            ) : null}
            {roster.notAttending.length > 0 ? (
              <RosterGroup
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
    <>
      <AppHeader organizer={organizer} theme={theme} signInNext={participantPath(publicToken)} />

      <Container size="1" px="4" py="6">
        <Stack gap="6">
          {/* Writes this device's zone into a cookie on a first visit, so the
            server can render every later paint on the right clock. */}
          <TimeZoneSync hasPreference={preferredTimeZone !== null} />

          {/*
          The event's own name is the last crumb, so somebody who arrived from
          a WhatsApp link with no other context can still see what this screen
          belongs to and get back out to the product.
        */}
          <PageBreadcrumb
            label={copy.nav.breadcrumbLabel}
            items={[
              organizer
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

          {/*
          The RSVP box comes BEFORE the roster.

          Everyone arrives here from a WhatsApp link with one thing to do: say
          whether they are coming. Putting the roster first meant scrolling past
          four groups of names to reach the only control on the page — on a
          phone that is most of a screen and a half of scrolling before you can
          act. Who else is coming is interesting; answering is the point.
        */}
          {event.isClosed ? (
            <Notice tone="warning" title={copy.event.closedNotice} />
          ) : organizer ? (
            <JoinPanel
              publicToken={publicToken}
              mine={mine}
              isFull={roster.openSlots !== null && roster.openSlots === 0}
              account={{ displayName: organizer.displayName, avatarUrl: organizer.avatarUrl }}
            />
          ) : null}

          {/* Immediately under the answer, because it is the rest of the same
            act: you said you are coming, here is what is still missing. */}
          {!event.isClosed && myPolicies.length > 0 ? (
            <PolicyPanel publicToken={publicToken} items={myPolicies} />
          ) : null}

          {/*
            For a signed-out reader the rest of the page is the teaser and the
            card rides on top of it. Everybody else gets it plainly: somebody
            who can act on these numbers has no business reading them through
            a fade.
          */}
          {organizer || event.isClosed ? (
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
    </>
  );
}
