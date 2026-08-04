import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
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

    const prefill = data.from
      ? await dup.loadEventAsFormValues(data.from, organizer.id, locale)
      : null;

    const [eventTypes, policyOptionsByType] = await Promise.all([
      catalog.loadEventTypes(locale),
      catalog.loadPolicyOptionsByEventType(locale),
    ]);

    return {
      title: copy.createEvent.title,
      locale,
      defaultTimeZone: preferredTimeZone ?? DEFAULT_TIME_ZONE,
      eventTypes,
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
  const { locale, defaultTimeZone, eventTypes, policyOptionsByType, prefill } =
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
        <CreateEventForm
          defaultTimeZone={defaultTimeZone}
          defaultLocale={locale}
          eventTypes={eventTypes}
          policyOptionsByType={policyOptionsByType}
          prefill={prefill}
        />
      </Stack>
    </Container>
  );
}
