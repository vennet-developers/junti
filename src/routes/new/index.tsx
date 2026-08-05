import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { TrackView } from "@/components/track-view";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, signInPath } from "@/config/routes";

import { CreateEventForm } from "./-create-event-form";

/**
 * Everything the create form needs, in one round trip: the gate, the
 * catalogue, the organizer's stored zone, and — for "duplicate and edit" —
 * the prefill, loaded HERE so a fabricated `?from=` id yields nothing
 * instead of a form pre-filled with somebody else's event. Ownership is part
 * of the query, not a check after it.
 */
const getCreateContext = createServerFn({ method: "GET" })
  .validator((data: { from?: string }) => data)
  .handler(async ({ data }) => {
    const [{ getViewerCopy }, { getOrganizer }, catalog, { resolvePreferences }, { DEFAULT_TIME_ZONE }, dup] =
      await Promise.all([
        import("@/lib/locale"),
        import("@/lib/organizer"),
        import("@/lib/catalog"),
        import("@/lib/preferences"),
        import("@/lib/format"),
        import("@/lib/duplication"),
      ]);

    const organizer = await getOrganizer();

    /*
      Creating needs an account, so this is a door rather than an offer. The
      anonymous flow — the sign-in card, the sessionStorage draft — left with
      the unowned events it existed for.
    */
    if (!organizer) {
      throw redirect({ to: signInPath(ROUTES.newEvent) as never });
    }

    const { copy, locale } = await getViewerCopy();

    // A stored or detected zone beats the floor: somebody who set Bogotá in
    // their profile while living in Madrid should not re-pick it every event.
    const { timeZone: preferredTimeZone } = await resolvePreferences();

    // The stored default currency — same idea as the zone, read from the row
    // rather than a cookie because only this form ever needs it.
    const { loadStoredPreferences } = await import("@/lib/preferences");
    const stored = await loadStoredPreferences(organizer.id);

    const prefill = data.from
      ? await dup.loadEventAsFormValues(data.from, organizer.id, locale)
      : null;

    const { loadOwnedGroups } = await import("@/lib/groups");

    const [eventTypes, policyOptionsByType, ownedGroups] = await Promise.all([
      catalog.loadEventTypes(locale),
      catalog.loadPolicyOptionsByEventType(locale),
      loadOwnedGroups(organizer.id),
    ]);

    return {
      title: copy.createEvent.title,
      locale,
      defaultTimeZone: preferredTimeZone ?? DEFAULT_TIME_ZONE,
      defaultCurrency: stored.currency ?? "COP",
      eventTypes,
      groups: ownedGroups.map((group) => ({ id: group.id, name: group.name })),
      policyOptionsByType,
      /*
        Typed down from `Record<string, unknown>`: `unknown` is not a
        serialisable type as far as the server-function boundary can prove,
        and one unprovable field collapses the whole loader's type to
        `unknown` at the call site. The values really are form-field strings.
      */
      prefill: prefill as Record<string, string> | null,
    };
  });

export const Route = createFileRoute("/new/")({
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: ({ deps }) => getCreateContext({ data: { from: deps.from } }),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: NewEventPage,
});

function NewEventPage() {
  const { copy } = useCopy();
  const {
    locale,
    defaultTimeZone,
    defaultCurrency,
    eventTypes,
    groups,
    policyOptionsByType,
    prefill,
  } =
    Route.useLoaderData();

  return (
    <Container size="2" px="4" py="6">
      <Stack gap="6">
        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[
            { label: copy.auth.myEventsLink, href: ROUTES.myEvents },
            { label: copy.nav.newEvent },
          ]}
        />

        <Stack gap="2">
          <Text variant="h1" fontFamily="var(--junti-display)">
            {copy.createEvent.heading}
          </Text>
          <Text color="muted">{copy.createEvent.subheading}</Text>
        </Stack>

        {/* A fixed floor, NOT a guess: the server cannot know the organizer's
            zone (Intl there answers with the server's own, UTC on Vercel), so
            the form detects the real one on mount and this is only what the
            first paint shows. */}
        {/* The organizer funnel starts here. The per-step events land with the
              wizard — see ANALYTICS.md. */}
        <TrackView name="create_started" props={{ from_duplicate: Boolean(prefill) }} />
        <CreateEventForm
          defaultTimeZone={defaultTimeZone}
          defaultCurrency={defaultCurrency}
          defaultLocale={locale}
          eventTypes={eventTypes}
          groups={groups}
          policyOptionsByType={policyOptionsByType}
          prefill={prefill}
        />
      </Stack>
    </Container>
  );
}
