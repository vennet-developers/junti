import { Badge } from "@stackmyth/badge";
import { Banner } from "@stackmyth/banner";
import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { CheckCircleIcon, InfoIcon } from "@stackmyth/icons";
import { Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useTransition } from "react";

import { Link } from "@/components/link";
import { useCopy } from "@/components/copy-provider";
import { groupJoinPath, signInPath } from "@/config/routes";
import { pageTitle } from "@/lib/page-title";
import { participantPath } from "@/lib/paths";

/**
 * A held spot's claim page: where the person the seat was reserved FOR takes
 * it in their own name.
 *
 * The link arrives by the sponsor's own WhatsApp — never by anything Junti
 * sends — so the reader lands here already knowing who invited them and to
 * what. The page's job is three sentences and one button, and then the offer
 * that makes this feature the growth loop it exists to be: the groups this
 * seat came through, joinable with the exact consent flow groups always had.
 *
 * Signing in is required to CLAIM, not to look. Same shape as the event page:
 * the details render for anybody holding the link, only the act needs an
 * account.
 */
const getClaimPage = createServerFn({ method: "GET" })
  .validator((data: { claimToken: string }) => data)
  .handler(async ({ data }) => {
    const [
      { db },
      { heldSpots, participants, events, groups, groupMembers, userProfiles },
      { and, eq, inArray },
      { getOrganizer },
      { getCopy },
      { resolveEventLocale },
      { formatEventDateTime },
      { readingTimeZone, resolvePreferences },
    ] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("drizzle-orm"),
      import("@/lib/organizer"),
      import("@/config/copy"),
      import("@/lib/locale"),
      import("@/lib/format"),
      import("@/lib/preferences"),
    ]);

    const [spot] = await db
      .select()
      .from(heldSpots)
      .where(eq(heldSpots.claimToken, data.claimToken))
      .limit(1);
    if (!spot) throw notFound();

    const [event] = await db.select().from(events).where(eq(events.id, spot.eventId)).limit(1);
    if (!event) throw notFound();

    const [sponsor] = await db
      .select({ displayName: participants.displayName, userId: participants.userId })
      .from(participants)
      .where(eq(participants.id, spot.sponsorParticipantId))
      .limit(1);
    if (!sponsor) throw notFound();

    const locale = await resolveEventLocale(event.locale);
    const copy = getCopy(locale);
    const { timeZone: preferred } = await resolvePreferences();
    const organizer = await getOrganizer();

    /*
      The groups on offer: the event's own, plus every group the SPONSOR
      belongs to. Listing the sponsor's memberships to their invitee is a
      disclosure the sponsor authorised by sending this link — and joining
      stays the invitee's explicit tap per group, through the same join-token
      consent flow groups have always had. Nothing joins anybody silently.
    */
    const memberships = await db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(and(eq(groupMembers.userId, sponsor.userId), eq(groupMembers.status, "joined")));

    const groupIds = [
      ...new Set([...memberships.map((m) => m.groupId), ...(event.groupId ? [event.groupId] : [])]),
    ];

    const offeredGroups =
      groupIds.length > 0
        ? await db
            .select({ id: groups.id, name: groups.name, joinToken: groups.joinToken })
            .from(groups)
            .where(inArray(groups.id, groupIds))
        : [];

    const [profile] = organizer
      ? await db
          .select({ fullName: userProfiles.fullName })
          .from(userProfiles)
          .where(eq(userProfiles.userId, organizer.id))
          .limit(1)
      : [];

    return {
      locale,
      claimToken: data.claimToken,
      signedIn: organizer !== null,
      suggestedName: profile?.fullName ?? organizer?.displayName ?? "",
      spot: {
        guestName: spot.guestName,
        claimed: spot.claimedBy !== null,
        claimedByMe: organizer !== null && spot.claimedBy === organizer.id,
      },
      sponsorName: sponsor.displayName,
      event: {
        title: event.title,
        publicToken: event.publicToken,
        when: formatEventDateTime(
          event.startsAt,
          readingTimeZone(preferred, event.timeZone),
          copy.intlLocale,
        ),
        location: event.location,
        over: event.cancelledAt !== null || event.closedAt !== null,
      },
      groups: offeredGroups,
    };
  });

const claimSpotFn = createServerFn({ method: "POST" })
  .validator((data: { claimToken: string }) => data)
  .handler(async ({ data }) => {
    const [
      { db },
      { heldSpots, participants, events },
      { and, eq, isNull },
      { getOrganizer },
      { getCopy },
      { resolveEventLocale },
      { claimProblem },
      { track },
      { uuidv7 },
    ] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("drizzle-orm"),
      import("@/lib/organizer"),
      import("@/config/copy"),
      import("@/lib/locale"),
      import("@/domain/held-spots"),
      import("@/lib/analytics"),
      import("uuidv7"),
    ]);

    const copy = getCopy(await resolveEventLocale("es"));

    const organizer = await getOrganizer();
    if (!organizer) return { error: copy.errors.signInRequired };

    const [spot] = await db
      .select()
      .from(heldSpots)
      .where(eq(heldSpots.claimToken, data.claimToken))
      .limit(1);
    if (!spot) return { error: copy.errors.notFound };

    const [event] = await db.select().from(events).where(eq(events.id, spot.eventId)).limit(1);
    if (!event) return { error: copy.errors.notFound };

    const [sponsor] = await db
      .select({ userId: participants.userId })
      .from(participants)
      .where(eq(participants.id, spot.sponsorParticipantId))
      .limit(1);

    const [already] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.eventId, event.id), eq(participants.userId, organizer.id)))
      .limit(1);

    const problem = claimProblem({
      claimedBy: spot.claimedBy,
      alreadyParticipant: already !== undefined,
      isSponsor: sponsor?.userId === organizer.id,
      eventCancelled: event.cancelledAt !== null,
      eventClosed: event.closedAt !== null,
    });

    if (problem !== null) {
      const message =
        problem === "taken"
          ? copy.claim.taken
          : problem === "own_spot"
            ? copy.claim.ownSpot
            : problem === "already_in"
              ? copy.claim.alreadyIn
              : copy.errors.eventClosed;
      return { error: message };
    }

    // The profile IS the name — same rule as every answer since 2026-08-08.
    const name = organizer.displayName.trim().slice(0, 40);
    if (name.length === 0) return { error: copy.errors.nameRequired };

    /*
      One transaction: the spot stops counting against the sponsor in the same
      instant its owner appears on the roster. Between the two statements the
      headcount would be off by one in one direction or the other, and a
      concurrent claim of the same spot must find it already taken. The WHERE
      on `claimedBy is null` is the race guard — second claimer updates zero
      rows and the insert never happens.
    */
    const result = await db.transaction(async (tx) => {
      const updated = await tx
        .update(heldSpots)
        .set({ claimedBy: organizer.id, claimedAt: new Date() })
        .where(and(eq(heldSpots.id, spot.id), isNull(heldSpots.claimedBy)))
        .returning({ id: heldSpots.id });

      if (updated.length === 0) return "taken" as const;

      await tx.insert(participants).values({
        id: uuidv7(),
        eventId: event.id,
        displayName: name,
        attendance: "in",
        userId: organizer.id,
        avatarUrl: organizer.avatarUrl,
      });

      return "ok" as const;
    });

    if (result === "taken") return { error: copy.claim.taken };

    track("spot_claimed", { event_id: event.id }, organizer.id);
    return { error: null, eventPath: `/e/${event.publicToken}` };
  });

export const Route = createFileRoute("/c/$claim_token")({
  loader: ({ params }) => getClaimPage({ data: { claimToken: params.claim_token } }),
  head: ({ loaderData }) => ({
    // A claim link is access to a seat: never indexed, like every token URL.
    meta: [
      { title: pageTitle(loaderData?.event.title) },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ClaimPage,
});

function ClaimPage() {
  const data = Route.useLoaderData();
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [claimedNow, setClaimedNow] = useState(false);

  const strings = copy.claim;
  const claimed = data.spot.claimed || claimedNow;

  function claim() {
    startTransition(async () => {
      const result = await claimSpotFn({
        data: { claimToken: data.claimToken },
      });
      if (result.error) {
        setError(result.error);
      } else {
        setError(null);
        setClaimedNow(true);
        await router.invalidate();
      }
    });
  }

  return (
    <Container size="1" px="4" py="6">
      <Stack gap="5">
        <Stack gap="2">
          <Badge variant="secondary" size="md" soft>
            {strings.kicker(data.sponsorName)}
          </Badge>
          <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
            {data.event.title}
          </Text>
          <Text color="muted">
            {data.event.when}
            {data.event.location ? ` · ${data.event.location}` : ""}
          </Text>
        </Stack>

        {data.event.over ? (
          <Banner variant="warning" live="off" icon={<InfoIcon size={18} aria-hidden="true" />} title={copy.event.closedNotice} />
        ) : claimed ? (
          <Stack gap="4">
            <Banner
              variant="success"
              live="polite"
              icon={<CheckCircleIcon size={18} aria-hidden="true" />}
              title={data.spot.claimedByMe || claimedNow ? strings.yours : strings.takenTitle}
            >
              {data.spot.claimedByMe || claimedNow ? strings.yoursBody : strings.taken}
            </Banner>

            {(data.spot.claimedByMe || claimedNow) && (
              <>
                <Button asChild size="lg" fullWidth>
                  <Link href={participantPath(data.event.publicToken)}>{strings.goToEvent}</Link>
                </Button>

                {data.groups.length > 0 ? (
                  <Card surface="outlined">
                    <CardContent>
                      <Stack gap="3">
                        <Stack gap="1">
                          <Text weight="semibold">{strings.groupsHeading(data.sponsorName)}</Text>
                          <Text variant="small" color="muted">
                            {strings.groupsHelp}
                          </Text>
                        </Stack>
                        {data.groups.map((group) => (
                          <Flex key={group.id} gap="3" align="center" justify="between">
                            <Text variant="small" weight="medium">
                              {group.name}
                            </Text>
                            <Button asChild size="sm" variant="secondary">
                              <Link href={groupJoinPath(group.joinToken)}>{strings.viewGroup}</Link>
                            </Button>
                          </Flex>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            )}
          </Stack>
        ) : !data.signedIn ? (
          <Card surface="outlined">
            <CardContent>
              <Stack gap="3">
                <Text weight="semibold">{strings.holdIsYours(data.sponsorName)}</Text>
                <Text variant="small" color="muted">
                  {strings.signInToClaim}
                </Text>
                <Button asChild size="lg" fullWidth>
                  <Link href={signInPath(`/c/${data.claimToken}`)}>{copy.rsvp.signInCta}</Link>
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Card surface="outlined">
            <CardContent>
              <Stack gap="3">
                <Text weight="semibold">{strings.holdIsYours(data.sponsorName)}</Text>
                {error ? (
                  <Text variant="small" color="error">
                    {error}
                  </Text>
                ) : null}
                <Button size="lg" fullWidth onClick={claim} disabled={pending}>
                  {pending ? strings.claiming : strings.claimCta}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
