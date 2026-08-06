import { Button } from "@stackmyth/button";
import { PlusIcon } from "@stackmyth/icons";
import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { CreatedToast } from "@/components/created-toast";
import { Link } from "@tanstack/react-router";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, signInPath } from "@/config/routes";

import { Agenda, type PendingInvite } from "./-agenda";
import { AgendaFallback } from "./-agenda-fallback";
import type { EventListItem } from "./-event-list";

/**
 * Everything the agenda page needs, in one round trip.
 *
 * Under Next this was two halves: a fast shell (auth and preferences, from
 * cookies) and a slow `<Agenda>` (the database work) streaming in behind an
 * explicit `<Suspense>`. TanStack has no per-component streaming, so the
 * split changes shape rather than disappearing: this one server function
 * loads both halves, and the wait the boundary used to cover is the route's
 * `pendingComponent` below — which replays the same traced skeleton the
 * Suspense fallback did.
 */
const getAgenda = createServerFn({ method: "GET" }).handler(async () => {
  const [
    { getOrganizer },
    { loadShareTemplate, resolvePreferences },
    { loadMyEvents },
    { loadAllEventTypes },
    { formatEventDateTime, formatMoney },
    { shortEventTime },
    { paletteIndexFor },
    { renderShareMessage },
    urls,
  ] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/preferences"),
    import("@/lib/roster"),
    import("@/lib/catalog"),
    import("@/lib/format"),
    import("@/lib/event-time"),
    import("@/lib/palette"),
    import("@/lib/share-message"),
    import("@/lib/urls"),
  ]);

  const organizer = await getOrganizer();
  if (!organizer) throw redirect({ to: signInPath(ROUTES.myEvents) as never });

  const { copy, locale } = await resolvePreferences();

  /*
    Everything on this person's plate, not just what they made.

    Was `loadOrganizerEvents`, which answered "what did I create" — a question
    nobody opens this page with once they can also be invited to things. The
    replacement sorts as an agenda rather than a history: soonest first among
    what is coming, most recent first among what is done.

    Takes the organizer's id and email off the session already resolved above
    rather than re-resolving it inside: doing auth twice per request to save
    two arguments is the wrong trade.
  */
  const events = await loadMyEvents(organizer.id);

  const pending = events.filter((event) => event.role === "invited" && !event.isPast);

  // Absolute, because the share message is pasted into WhatsApp.
  const base = await urls.origin();

  // One lookup for every card: the organizer's own invitation, or the app's.
  const shareTemplate = await loadShareTemplate(organizer.id, copy.share.defaultMessage);

  // One lookup for the whole list: the catalogue is a handful of rows, and the
  // alternative is a join repeating the same labels on every event. Retired
  // kinds included — this labels events that exist, it is not a picker.
  const typeLabels = new Map(
    (await loadAllEventTypes(locale)).map((type) => [type.id, type.label] as const),
  );

  /*
    Everything the client needs, already formatted — dates in particular. Each
    event renders in its own zone and in the reader's language, both of which
    the server knows; sending Date objects instead would ship `Intl` formatting
    and the timezone list to the browser to arrive at the same strings.
  */
  const items: EventListItem[] = events.map((event) => ({
    role: event.role,
    /*
      `managePath` only exists for events this person owns, and the narrowing
      is what produces it: `organizerToken` is absent from every other variant
      of `MyEvent`, so this cannot be written any other way. See the union in
      roster.ts for why that is deliberate.
    */
    managePath:
      event.role === "organizer"
        ? urls.managePath(event.publicToken, event.organizerToken)
        : null,
    eventPath: urls.participantPath(event.publicToken),
    id: event.id,
    title: event.title,
    when: formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale),
    startsAtMs: event.startsAt.getTime(),
    isPast: event.isPast,
    location: event.location,
    typeLabel: typeLabels.get(event.eventTypeId) ?? null,
    /*
      Formatted here for the same reason the dates are: the currency and the
      reader's language both live on the server, and sending minor units plus a
      currency code would ship `Intl.NumberFormat` to the browser to arrive at
      this exact string. A free event says so rather than showing nothing —
      "no price" and "price not loaded" look identical on a card.
    */
    cost:
      event.costMode === "none" || event.costAmountMinor === null
        ? copy.money.free
        : formatMoney(event.costAmountMinor, event.currency, copy.intlLocale),
    /** True only when that amount is per head, which the card says out loud. */
    costPerPerson: event.costMode === "per_person",
    isClosed: event.isClosed,
    colorIndex: paletteIndexFor(event.eventTypeId),
    attendingCount: event.attendingCount,
    firstAttendees: event.firstAttendees,
    whatsAppUrl: urls.whatsAppShareUrl(
      renderShareMessage(shareTemplate, {
        title: event.title,
        when: shortEventTime(event.startsAt, event.timeZone, copy),
        link: `${base}${urls.participantPath(event.publicToken)}`,
      }),
    ),
  }));

  const invites: PendingInvite[] = pending.map((event) => ({
    id: event.id,
    title: event.title,
    eventPath: urls.participantPath(event.publicToken),
  }));

  return { title: copy.auth.myEventsTitle, items, pending: invites };
});

export const Route = createFileRoute("/my-events/")({
  validateSearch: (search: Record<string, unknown>): { created?: string } => ({
    created: typeof search.created === "string" ? search.created : undefined,
  }),
  loader: () => getAgenda(),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MyEventsPage,
  pendingComponent: MyEventsPending,
});

/**
 * The signed-in home: heading, create button, and the agenda under them.
 */
function MyEventsPage() {
  const { copy } = useCopy();
  const { created } = Route.useSearch();
  const { items, pending } = Route.useLoaderData();

  return (
    /*
      The scan tier. This screen is a list you sweep for the next thing you
      have to think about, and more of it in view is strictly better — see the
      width policy in globals.css. Costs nothing on a phone: `size` is a
      max-width, and at 390px a 880px cap and a 448px cap both simply fill the
      screen.
    */
    <Container size="3" px="4" py="6">
      <Stack gap="5">
        {/* Creation redirects here for account holders, so the confirmation
            arrives as a flag on the URL rather than with the action. */}
        {created === "1" ? <CreatedToast /> : null}

        {/*
          No breadcrumb here, and that is the trail being honest rather than
          an omission. This screen is the root of the signed-in app — `/`
          redirects to it — so the only crumb available is the page itself,
          and a one-item trail just restates the heading below it. A "Home"
          crumb above it would link to `/`, which bounces straight back here.
        */}
        <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
          {copy.auth.myEventsHeading}
        </Text>

        {/*
          The primary action sits above the list rather than under it. It used
          to be the last thing on the page, which meant an organizer with a
          dozen events scrolled past all of them to create the thirteenth.
        */}
        {/*
          Full-bleed on a phone, where the thumb wants the whole width; capped
          once the page is wide, because one button stretched across 880px
          stops reading as a button and starts reading as a banner. The cap
          goes on a wrapper so `fullWidth` keeps meaning "fill your parent"
          and the two do not fight each other.
        */}
        <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
          <Button asChild size="lg" fullWidth>
            <Link to={ROUTES.newEvent}>
              {/*
                A Flex here, unlike a plain Button. Button normally wraps its
                children in `.sm-button__content`, which supplies the 8px gap —
                but `asChild` clones the Link and that wrapper is never
                rendered, so without this the icon and the label touch.
                Verified in the DOM, not assumed.
              */}
              <Flex gap="2" align="center" justify="center">
                <PlusIcon size={16} aria-hidden="true" />
                {copy.home.cta}
              </Flex>
            </Link>
          </Button>
        </Box>

        <Agenda items={items} pending={pending} />
      </Stack>
    </Container>
  );
}

/**
 * Placeholder while the loader runs — what `loading.tsx` and the page's own
 * `AgendaFallback` were under Next, now one component because the loader
 * loads shell and agenda together and there is only one wait to cover.
 *
 * No header skeleton, and none needed: the real header renders from the root
 * route, which a pending state does not replace.
 *
 * **Two layers below, because navigations come in two kinds.** On a soft
 * navigation this component is mounted by client React, so the
 * `AutoSkeleton` inside `AgendaFallback` replays the agenda's traced bones —
 * the same pair by name as the capture in `-agenda.tsx`. On a hard load
 * nothing has been traced in this session yet, so the committed seed in
 * `-agenda-bones.ts` (registered at module scope) stands in, with the
 * hand-drawn furniture as the floor under that. Both honest, one exact.
 *
 * The furniture that stays hand-drawn is deliberately only what cannot drift:
 * a heading-shaped bar, the create button at its real capped width. The part
 * that *changes shape between breakpoints* — the cards — is exactly the part
 * left to the trace, because guessing at it is how the old hand-drawn
 * skeleton went stale.
 */
function MyEventsPending() {
  return (
    <Container size="3" px="4" py="6">
      <Stack gap="5" aria-hidden="true">
        <Skeleton width="45%" height="30px" borderRadius="var(--sm-radius-md)" />

        {/* The create button, capped exactly where the real one is capped. */}
        <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
          <Skeleton width="100%" height="50px" borderRadius="var(--sm-radius-md)" />
        </Box>

        {/* The agenda region: traced replay when bones exist, the static
            furniture when nothing has been captured yet. */}
        <AgendaFallback />
      </Stack>
    </Container>
  );
}
