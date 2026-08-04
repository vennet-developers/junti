"use client";

import { Box, Flex, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";
import { AutoSkeleton, registerBones } from "@stackmyth/skeleton/auto";

import { AGENDA_SEED } from "./-agenda-bones";

/**
 * One name shared by the two halves of the boundary: `Agenda` captures under
 * it, this fallback replays from it. A typo between the two would not error —
 * it would just quietly never find bones — so the string exists exactly once.
 */
export const AGENDA_SKELETON_NAME = "my-events-agenda";

/*
  The committed capture, registered the moment this module loads — which is
  before any effect can read the registry, so even the first render of a wait
  finds it. Module scope rather than an effect on purpose: an effect would run
  after the fallback's own first lookup and cost exactly the frame this exists
  to fill. Harmless during SSR — the registry is a plain Map there and the
  server branch never reads it.

  Live captures overwrite this bucket as soon as the real agenda renders, so
  the seed decides only what a first-ever visit sees. See `-agenda-bones.ts`
  for how to refresh it.
*/
registerBones(AGENDA_SKELETON_NAME, AGENDA_SEED);

/**
 * What shows in the agenda's slot while the route's loader runs.
 *
 * The replay side of the pair in `-agenda.tsx`. Under Next this sat inside a
 * `<Suspense>` boundary in the page; TanStack has no per-component streaming,
 * so it renders from the route's `pendingComponent` instead — mounted by
 * client React on every soft navigation, which is exactly the condition the
 * pattern needs: `AutoSkeleton` measures the container, finds the bones the
 * last visit traced, and replays the agenda's exact rectangles — the same
 * grid, the same rows, the same widths — without this file describing any of
 * them.
 *
 * The hand-drawn part below is only the floor under that: what a visitor sees
 * when there is nothing to replay — the first visit ever, or a hard reload,
 * where the pending markup is server HTML and no traced bones exist yet.
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
