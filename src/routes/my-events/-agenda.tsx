"use client";

import { Box, Stack } from "@stackmyth/layout";
import { AutoSkeleton } from "@stackmyth/skeleton/auto";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { Link } from "@/components/link";
import { Notice } from "@/components/notice";

import { AGENDA_SKELETON_NAME } from "./-agenda-fallback";
import { EventList, type EventListItem } from "./-event-list";

/**
 * An invitation still waiting on an answer, flattened for the client. The
 * path is prebuilt because `participantPath` lives in `@/lib/urls`, which is
 * server-only — the loader resolves it and ships the string.
 */
export interface PendingInvite {
  id: string;
  title: string;
  eventPath: string;
}

/**
 * The agenda: the pending-invitations notice and the event list.
 *
 * Under Next this was an async server component streaming in behind an
 * explicit `<Suspense>`; its database work now lives in the route's server
 * function (see `index.tsx`), which loads shell and agenda in one round trip,
 * and this half is plain client JSX over the data that arrives by props. The
 * wait the Suspense boundary used to cover is the route's `pendingComponent`.
 *
 * **The `AutoSkeleton` wrapper is the capture side of that boundary.** It never
 * shows a skeleton here — `loading={false}` always — its job is to trace the
 * rendered agenda after paint so the *fallback* (`-agenda-fallback.tsx`, the
 * other half of the pair, same name) can replay those exact rectangles on the
 * next navigation. The reason the pair works is that the pending UI is mounted
 * by client React on every soft navigation — the condition a Next route-level
 * `loading.tsx` (streamed HTML, never hydrated) could not meet. That
 * distinction cost an afternoon to find; it is written on `AutoSkeleton`
 * itself now.
 */
export function Agenda({
  items,
  pending,
}: {
  items: EventListItem[];
  /*
    Asked and unanswered, lifted out of the list and pinned above it.

    It is the only state on this page that wants something from the reader; the
    rest is a record of decisions already made. Left inline it reads as one more
    row among events that need nothing.
  */
  pending: PendingInvite[];
}) {
  const { copy } = useCopy();

  return (
    <AutoSkeleton name={AGENDA_SKELETON_NAME} loading={false}>
      <Stack gap="5">
        {/*
          Above the list and above the search, because it is the only thing
          here that is waiting on the reader. Names the events rather than
          just counting them: "you were invited to 2 events" without saying
          which ones sends somebody hunting through a list to find what this
          notice already knew.
        */}
        {pending.length > 0 ? (
          <Notice tone="info" title={copy.auth.pendingTitle(pending.length)}>
            <Stack gap="2" pt="2">
              <Text variant="small" color="muted">
                {copy.auth.pendingHelp}
              </Text>
              {pending.map((event) => (
                <Box key={event.id} as={Link} href={event.eventPath}>
                  <Text variant="small" weight="semibold">
                    {event.title}
                  </Text>
                </Box>
              ))}
            </Stack>
          </Notice>
        ) : null}

        <EventList events={items} />
      </Stack>
    </AutoSkeleton>
  );
}
