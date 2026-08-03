import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";
import { AutoSkeleton } from "@stackmyth/skeleton/auto";

import { AGENDA_SKELETON_NAME } from "./agenda-fallback";

/**
 * Placeholder while the page itself is being fetched.
 *
 * Since the Suspense split in `page.tsx` this covers a shorter stretch than it
 * used to: only the wait before the shell arrives — auth and preferences —
 * after which the page's own `AgendaFallback` takes over inside the boundary.
 *
 * **Two layers, because navigations come in two kinds.** On a soft navigation
 * this file is mounted by client React — verified live, against an earlier
 * belief to the contrary that turned out to be a frozen browser tab — so the
 * `AutoSkeleton` below replays the agenda's traced bones, the same pair by
 * name as the fallback inside the page. On a hard load nothing in any fallback
 * hydrates (React streams and replaces, never mounts), so what shows is this
 * file's server HTML: the hand-drawn furniture around it, and the `fallback`
 * prop inside it. Both honest, one exact.
 *
 * The furniture that stays hand-drawn is deliberately only what cannot drift:
 * the shell's frame, a heading-shaped bar, the create button at its real
 * capped width. The part that *changes shape between breakpoints* — the cards —
 * is exactly the part left to the trace, because guessing at it is how the old
 * hand-drawn skeleton went stale.
 */
export default function Loading() {
  return (
    <>
      <Box as="header" borderBottom="1px solid var(--sm-border-default)">
        {/* The shell's frame width — see `app-header.tsx`. */}
        <Container size="4" px="4">
          <Flex justify="between" align="center" gap="3" py="3">
            <Skeleton width="64px" height="28px" borderRadius="var(--sm-radius-md)" />
            {/* Measured against the real trigger, so the header does not
                resize when the menu replaces this: 144x51 at this app's
                density. The width assumes a two-word name and is the one
                number here that cannot be exact for everyone. */}
            <Skeleton width="145px" height="51px" borderRadius="var(--sm-radius-full)" />
          </Flex>
        </Container>
      </Box>

      <Container size="3" px="4" py="6">
        <Stack gap="5" aria-hidden="true">
          <Skeleton width="45%" height="30px" borderRadius="var(--sm-radius-md)" />

          {/* The create button, capped exactly where the real one is capped. */}
          <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
            <Skeleton width="100%" height="50px" borderRadius="var(--sm-radius-md)" />
          </Box>

          {/*
            The agenda region: traced replay on soft navigations, the static
            `fallback` prop on hard loads. Same name as the page's own pair, so
            every fallback on this route replays the same capture.
          */}
          <AutoSkeleton
            name={AGENDA_SKELETON_NAME}
            loading
            animate="shimmer"
            fallback={<Furniture />}
          >
            {null}
          </AutoSkeleton>
        </Stack>
      </Container>
    </>
  );
}

/** Width-independent bars for the un-traced case — search, tabs, one card. */
function Furniture() {
  return (
    <Stack gap="4">
      <Skeleton width="100%" height="45px" borderRadius="var(--sm-radius-md)" animate="shimmer" />
      <Skeleton width="100%" height="40px" borderRadius="var(--sm-radius-md)" animate="shimmer" />
      <Skeleton width="100%" height="180px" borderRadius="var(--sm-radius-lg)" animate="shimmer" />
    </Stack>
  );
}
