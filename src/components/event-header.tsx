import { Badge } from "@stackmyth/badge";
import { CalendarIcon, MapPinIcon, UserIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";
import { describeEventTime } from "@/lib/event-time";
import type { EventView } from "@/lib/roster";

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function DetailRow({ icon, label, children }: DetailRowProps) {
  return (
    <Flex gap="3" align="start">
      <Text as="span" color="muted" aria-hidden="true">
        {icon}
      </Text>
      {/* Children are rendered raw rather than wrapped in <Text>, because the
          "when" row is two stacked lines and a <div> inside a <p> is invalid
          nesting. Callers passing a plain string wrap it themselves. */}
      <Stack gap="0">
        <Text variant="small" color="muted">
          {label}
        </Text>
        {children}
      </Stack>
    </Flex>
  );
}

export interface EventHeaderProps {
  event: EventView;
  /** SEATS taken, not rows: a sponsor bringing three guests counts as four. */
  attendingCount: number;
  copy: Copy;
  /** The reader's zone. Falls back to the event's, which shows one line. */
  readerTimeZone: string;
  /**
   * Spots still free, or null when the event has no cap.
   *
   * Comes from the roster rather than being derived from `capacity` minus
   * `attendingCount`, because the waitlist has its own rules about what counts
   * as holding a spot and this header has no business reimplementing them.
   */
  openSlots: number | null;
}

export function EventHeader({
  event,
  attendingCount,
  copy,
  readerTimeZone,
  openSlots,
}: EventHeaderProps) {
  const when = describeEventTime({
    startsAt: event.startsAt,
    eventTimeZone: event.timeZone,
    readerTimeZone,
    copy,
  });

  const capacityText =
    event.capacity === null
      ? copy.event.capacityUnlimited
      : copy.event.capacityValue(attendingCount, event.capacity);

  return (
    <Stack gap="4">
      <Stack gap="2">
        <Flex gap="2" align="center" wrap="wrap">
          <Badge variant="secondary" size="sm">
            {event.eventTypeLabel}
          </Badge>
          {event.isClosed ? (
            <Badge variant="error" size="sm" soft>
              {copy.event.closedBadge}
            </Badge>
          ) : null}

          {/*
            "Spots left" belongs in this row and not in a notice of its own.

            It was a full-width card between the header and the RSVP box —
            roughly 90px of vertical space on a phone to carry four words, on the
            screen whose whole job is to get somebody to the answer quickly. It
            is a status about the event, which is exactly what the badges beside
            it are, so it costs nothing here.

            Not shown when the event is closed or full: a closed event's spots
            are moot, and a full one says so in the RSVP box, where the
            consequence actually applies. Saying it twice on one screen is noise.
          */}
          {!event.isClosed && openSlots !== null && openSlots > 0 ? (
            <Badge variant="info" size="sm" soft>
              {copy.event.spotsLeft(openSlots)}
            </Badge>
          ) : null}
        </Flex>
        {/*
          h2, not h1. Stackmyth's h1 is sized for a desktop hero; at 390px an
          ordinary event name like "Fútbol de los jueves" wrapped to two lines
          and ate a third of the first screen. This is still the page's main
          heading semantically — `as="h1"` keeps the document outline correct
          while `variant` carries only the size.
        */}
        <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
          {event.title}
        </Text>
      </Stack>

      <Stack gap="3">
        <DetailRow icon={<CalendarIcon size={18} />} label={copy.event.whenLabel}>
          <Stack gap="0">
            {/* The time is display type, alongside titles and amounts — the
                three things the brand sets in Bricolage. The secondary line
                below stays in the interface face: it is a clarification, not
                a headline. */}
            <Text fontFamily="var(--junti-display)" weight="bold">
              {when.primary}
            </Text>
            {/* Only when the reader is somewhere else. Both times, both
                places — a converted time without its zone is how a group ends
                up disagreeing about when the match is. */}
            {when.secondary ? (
              <Text variant="small" color="muted">
                {when.secondary}
              </Text>
            ) : null}
          </Stack>
        </DetailRow>

        <DetailRow icon={<MapPinIcon size={18} />} label={copy.event.whereLabel}>
          <Text>{event.location ?? copy.event.noLocation}</Text>
        </DetailRow>

        <DetailRow icon={<UserIcon size={18} />} label={copy.event.capacityLabel}>
          <Text>{capacityText}</Text>
        </DetailRow>
      </Stack>

      {event.notes ? (
        <Stack gap="1">
          <Text variant="small" color="muted">
            {copy.event.notesLabel}
          </Text>
          <Text>{event.notes}</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
