import { Button } from "@stackmyth/button";
import { EmptyState } from "@stackmyth/empty-state";
import { HelpCircleIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { Center, Container, Flex } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";
import { Stack } from "@stackmyth/layout";
import { Link, useRouter } from "@tanstack/react-router";

import { es } from "@/config/copy/es";

/**
 * The router's default boundaries — what `error.tsx`, `not-found.tsx` and a
 * generic `loading.tsx` were under Next, as components instead of files.
 *
 * They read the Spanish copy directly for now. That is a phase-1 shortcut,
 * not the design: the locale machinery (`resolveEventLocale`, the cookie, the
 * provider) crosses in phase 3, and these switch to it then. Hardcoding the
 * default language beats hardcoding English placeholders that nobody will
 * remember to translate back.
 */

const copy = es;

export function RouteNotFound() {
  return (
    /* Centred for the same reason the Next 404 was — one short card pinned to
       the top of a 900px screen reads as a page that failed to load. */
    <Center minHeight={{ base: "auto", md: "62dvh" }}>
      <Container size="1" px="4" py="8">
        <EmptyState
          icon={<HelpCircleIcon size={28} />}
          title={copy.event.notFoundTitle}
          description={copy.event.notFoundBody}
          action={
            <Button asChild size="md" variant="secondary">
              <Link to="/">{copy.common.back}</Link>
            </Button>
          }
        />
      </Container>
    </Center>
  );
}

export function RouteBoundary({ error }: { error: Error }) {
  const router = useRouter();

  // Same policy as the Next error boundary: no tracking service on the
  // zero-cost tier, so the detail goes where a developer will look.
  console.error("Route error:", error);

  return (
    <Center minHeight={{ base: "auto", md: "62dvh" }}>
      <Container size="1" px="4" py="8">
        <EmptyState
          icon={<TriangleAlertIcon size={28} />}
          title={copy.errorBoundary.title}
          description={copy.errorBoundary.body}
          action={
            <Flex gap="2" wrap="wrap" justify="center">
              <Button type="button" size="md" onClick={() => router.invalidate()}>
                {copy.errorBoundary.retry}
              </Button>
              <Button asChild size="md" variant="secondary">
                <Link to="/">{copy.errorBoundary.home}</Link>
              </Button>
            </Flex>
          }
        />
      </Container>
    </Center>
  );
}

/** Neutral furniture for a route with no skeleton of its own. */
export function RoutePending() {
  return (
    <Container size="3" px="4" py="6">
      <Stack gap="5" aria-hidden="true">
        <Skeleton width="45%" height="30px" borderRadius="var(--sm-radius-md)" />
        <Skeleton width="100%" height="45px" borderRadius="var(--sm-radius-md)" animate="shimmer" />
        <Skeleton width="100%" height="180px" borderRadius="var(--sm-radius-lg)" animate="shimmer" />
      </Stack>
    </Container>
  );
}
