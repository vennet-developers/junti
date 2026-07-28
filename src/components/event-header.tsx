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
  attendingCount: number;
  copy: Copy;
  /** The reader's zone. Falls back to the event's, which shows one line. */
  readerTimeZone: string;
}

export function EventHeader({ event, attendingCount, copy, readerTimeZone }: EventHeaderProps) {
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
        </Flex>
        {/*
          h2, not h1. Stackmyth's h1 is sized for a desktop hero; at 390px an
          ordinary event name like "Fútbol de los jueves" wrapped to two lines
          and ate a third of the first screen. This is still the page's main
          heading semantically — `as="h1"` keeps the document outline correct
          while `variant` carries only the size.
        */}
        <Text as="h1" variant="h2">
          {event.title}
        </Text>
      </Stack>

      <Stack gap="3">
        <DetailRow icon={<CalendarIcon size={18} />} label={copy.event.whenLabel}>
          <Stack gap="0">
            <Text>{when.primary}</Text>
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
