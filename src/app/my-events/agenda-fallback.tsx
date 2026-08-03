"use client";

import { Box, Flex, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";
import { AutoSkeleton } from "@stackmyth/skeleton/auto";

/**
 * One name shared by the two halves of the boundary: `Agenda` captures under
 * it, this fallback replays from it. A typo between the two would not error —
 * it would just quietly never find bones — so the string exists exactly once.
 */
export const AGENDA_SKELETON_NAME = "my-events-agenda";

/**
 * What shows inside the agenda's Suspense boundary while the queries run.
 *
 * The replay side of the pair in `agenda.tsx`. On a soft navigation this is
 * mounted by client React — the reason this pattern works where `loading.tsx`
 * did not — so `AutoSkeleton` measures the container, finds the bones the last
 * visit traced, and replays the agenda's exact rectangles: the same grid, the
 * same rows, the same widths, without this file describing any of them.
 *
 * The hand-drawn part below is only the floor under that: what a visitor sees
 * when there is nothing to replay — the first visit ever, or a hard reload,
 * where a streamed fallback never hydrates and only its server HTML shows.
 * It draws the two fixtures that are true at any width (search bar, tab row)
 * and deliberately stops before the cards: guessing at a grid that may be one
 * column or two is exactly how the old hand-drawn skeleton went stale.
 */
export function AgendaFallback() {
  return (
    <AutoSkeleton name={AGENDA_SKELETON_NAME} loading animate="shimmer" fallback={<Furniture />}>
      {null}
    </AutoSkeleton>
  );
}

/** The width-independent fixtures, for loads with nothing traced yet. */
function Furniture() {
  return (
    <Stack gap="4" aria-hidden="true">
      <Skeleton width="100%" height="45px" borderRadius="var(--sm-radius-md)" animate="shimmer" />
      <Skeleton width="100%" height="40px" borderRadius="var(--sm-radius-md)" animate="shimmer" />
      <Flex gap="3" pt="1">
        <Box flex="1">
          <Skeleton
            width="100%"
            height="180px"
            borderRadius="var(--sm-radius-lg)"
            animate="shimmer"
          />
        </Box>
      </Flex>
    </Stack>
  );
}
