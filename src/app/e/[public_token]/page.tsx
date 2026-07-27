import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { Container, Divider, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { EventHeader } from "@/components/event-header";
import { MoneySummary } from "@/components/money-summary";
import { Notice } from "@/components/notice";
import { RosterGroup } from "@/components/roster-list";
import { copy } from "@/config/copy";
import { db } from "@/db/client";
import { participants } from "@/db/schema";
import { findEventByPublicToken, loadRoster } from "@/lib/roster";
import { editCookieName } from "@/lib/rsvp-cookie";
import { and, eq } from "drizzle-orm";

import { RsvpForm } from "./rsvp-form";

/**
 * The participant view.
 *
 * Everything here is safe for anyone holding the public link. The organizer
 * token is never loaded into this component — `loadRoster` returns an
 * `EventView` that has no such field, so it cannot leak into the HTML or the
 * server-component payload by accident.
 */

type Params = { public_token: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { public_token: publicToken } = await params;
  const event = await findEventByPublicToken(publicToken);

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

  const roster = await loadRoster(eventRow);

  // Identify this device's own RSVP, if it has one, so the form can prefill
  // and amend rather than creating a duplicate.
  const editToken = (await cookies()).get(editCookieName(eventRow.id))?.value;

  const mine = editToken
    ? ((
        await db
          .select({
            displayName: participants.displayName,
            attendance: participants.attendance,
          })
          .from(participants)
          .where(and(eq(participants.eventId, eventRow.id), eq(participants.editToken, editToken)))
          .limit(1)
      )[0] ?? null)
    : null;

  const { event } = roster;
  const showMoney = event.hasCost;

  return (
    <Container size="1">
      <Stack gap="6" py="6" px="4">
        <EventHeader event={event} attendingCount={roster.attending.length} />

        {/* Only the "spots left" nudge lives here. When the event is FULL the
            RSVP box says so itself, right where the consequence applies —
            saying it twice on one screen is noise. */}
        {!event.isClosed && roster.openSlots !== null && roster.openSlots > 0 ? (
          <Notice tone="info" title={copy.event.spotsLeft(roster.openSlots)} />
        ) : null}

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
        ) : (
          <RsvpForm
            publicToken={publicToken}
            mine={mine}
            isFull={roster.openSlots !== null && roster.openSlots === 0}
          />
        )}

        <Divider />

        <MoneySummary roster={roster} />

        {showMoney ? <Divider /> : null}

        <Stack gap="5">
          <Text variant="h3">{copy.roster.heading}</Text>

          {roster.members.length === 0 ? (
            <Text color="muted">{copy.roster.empty}</Text>
          ) : (
            <>
              <RosterGroup
                title={copy.roster.inTitle}
                members={roster.attending}
                currency={event.currency}
                showMoney={showMoney}
              />
              {roster.waitlisted.length > 0 ? (
                <RosterGroup
                  title={copy.roster.waitlistedTitle}
                  members={roster.waitlisted}
                  currency={event.currency}
                  showMoney={false}
                  numbered
                />
              ) : null}
              {roster.maybe.length > 0 ? (
                <RosterGroup
                  title={copy.roster.maybeTitle}
                  members={roster.maybe}
                  currency={event.currency}
                  showMoney={false}
                />
              ) : null}
              {roster.notAttending.length > 0 ? (
                <RosterGroup
                  title={copy.roster.outTitle}
                  members={roster.notAttending}
                  currency={event.currency}
                  showMoney={false}
                />
              ) : null}
            </>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
