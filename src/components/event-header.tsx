import { Badge } from "@stackmyth/badge";
import { CalendarIcon, MapPinIcon, UserIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";
import { formatEventDateTime } from "@/lib/format";
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
      <Stack gap="0">
        <Text variant="small" color="muted">
          {label}
        </Text>
        <Text>{children}</Text>
      </Stack>
    </Flex>
  );
}

export interface EventHeaderProps {
  event: EventView;
  attendingCount: number;
  copy: Copy;
}

export function EventHeader({ event, attendingCount, copy }: EventHeaderProps) {
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
          {formatEventDateTime(event.startsAt, event.timeZone, copy.intlLocale)}
        </DetailRow>

        <DetailRow icon={<MapPinIcon size={18} />} label={copy.event.whereLabel}>
          {event.location ?? copy.event.noLocation}
        </DetailRow>

        <DetailRow icon={<UserIcon size={18} />} label={copy.event.capacityLabel}>
          {capacityText}
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
