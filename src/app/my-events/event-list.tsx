"use client";

import { useMemo, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@stackmyth/accordion";
import { Badge } from "@stackmyth/badge";
import { Card, CardContent } from "@stackmyth/card";
import { EmptyState } from "@stackmyth/empty-state";
import { CalendarIcon, MapPinIcon, SearchIcon } from "@stackmyth/icons";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@stackmyth/input-group";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stackmyth/tabs";
import { Text } from "@stackmyth/text";

import { AttendeeStack } from "@/components/attendee-stack";
import { useCopy } from "@/components/copy-provider";

import { EventCardActions } from "./event-card-actions";

/**
 * One event, flattened for the client. Dates arrive pre-formatted: the server
 * already knows the reader's language and each event's zone, and formatting
 * there keeps `Intl` and the timezone table out of the browser bundle.
 */
export interface EventListItem {
  id: string;
  title: string;
  when: string;
  /** Epoch millis, only for ordering. Comparisons against "now" happen server-side. */
  startsAtMs: number;
  /** Decided on the server, so the first client paint cannot disagree with it. */
  isPast: boolean;
  location: string | null;
  typeLabel: string | null;
  isClosed: boolean;
  attendingCount: number;
  firstAttendees: string[];
  managePath: string;
  whatsAppUrl: string;
}

type Filter = "upcoming" | "past" | "all";

/**
 * The history, searchable and split by whether the event has happened.
 *
 * Client-side because both controls act on a list the server already sent in
 * full: an organizer has tens of events, not thousands, so filtering in the
 * browser is instant and costs no round trip. If that ever stops being true the
 * split moves into SQL and this component takes a page of results instead.
 */
export function EventList({ events }: { events: EventListItem[] }) {
  const { copy } = useCopy();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("upcoming");

  const buckets = useMemo(() => {
    const needle = term.trim().toLowerCase();

    const matches = needle
      ? events.filter(
          (event) =>
            event.title.toLowerCase().includes(needle) ||
            (event.location?.toLowerCase().includes(needle) ?? false),
        )
      : events;

    return {
      // Upcoming reads soonest-first — the next thing you have to think about
      // belongs at the top. Past keeps the newest-first order it arrives in.
      upcoming: matches
        .filter((event) => !event.isPast)
        .sort((a, b) => a.startsAtMs - b.startsAtMs),
      past: matches.filter((event) => event.isPast),
      all: matches,
    };
  }, [events, term]);

  const shown = buckets[filter];

  const emptyCopy: Record<Filter, { title: string; description: string }> = {
    upcoming: { title: copy.auth.noUpcoming, description: copy.auth.noUpcomingHelp },
    past: { title: copy.auth.noPast, description: copy.auth.noPastHelp },
    all: { title: copy.auth.myEventsEmpty, description: copy.auth.myEventsEmptyHelp },
  };

  return (
    <Stack gap="4">
      <InputGroup fullWidth>
        <InputGroupAddon>
          <SearchIcon size={18} aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          // xl, not lg: lg renders 43px inside an InputGroup — one pixel short
          // of the 44px minimum. Measured, not guessed.
          size="xl"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={copy.auth.searchPlaceholder}
          aria-label={copy.auth.searchLabel}
        />
      </InputGroup>

      {/*
        `lg` is the largest Tabs offers at 0.23.0 and yields a 36px trigger —
        short of the 44px minimum. `size="xl"` was added upstream for exactly
        this and lands with the next release; switch this line then.
      */}
      <Tabs size="lg" value={filter} onValueChange={(next) => setFilter(next as Filter)}>
        <TabsList fullWidth>
          <TabsTrigger value="upcoming">{copy.auth.tabUpcoming}</TabsTrigger>
          <TabsTrigger value="past">{copy.auth.tabPast}</TabsTrigger>
          <TabsTrigger value="all">{copy.auth.tabAll}</TabsTrigger>
        </TabsList>

        {/* One content panel per tab, all rendering the same list: Tabs needs a
            panel per trigger for the a11y wiring, and the filtering already
            happened above. */}
        {(["upcoming", "past", "all"] as const).map((value) => (
          <TabsContent key={value} value={value}>
            <Stack gap="3" pt="4">
              {shown.length === 0 ? (
                <EmptyState
                  icon={<CalendarIcon size={28} />}
                  title={term.trim() ? copy.auth.noMatches(term.trim()) : emptyCopy[value].title}
                  description={term.trim() ? undefined : emptyCopy[value].description}
                />
              ) : (
                shown.map((event) => <EventCard key={event.id} event={event} />)
              )}
            </Stack>
          </TabsContent>
        ))}
      </Tabs>
    </Stack>
  );
}

/**
 * A single event at a glance: what, when, who, where.
 *
 * The actions live behind a details toggle. Four buttons per card turned a list
 * of five events into a page you had to scroll to count them; collapsed, the
 * whole history fits on one screen and the actions are one tap away.
 */
function EventCard({ event }: { event: EventListItem }) {
  const { copy } = useCopy();

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <Flex justify="between" align="start" gap="3">
            <Box minWidth="0">
              <Stack gap="1">
                <Text weight="semibold">{event.title}</Text>
                <Text variant="small" color="muted">
                  {event.when}
                </Text>
              </Stack>
            </Box>

            <Box flexShrink={0}>
              {event.isClosed ? (
                <Badge variant="error" size="sm" soft>
                  {copy.event.closedBadge}
                </Badge>
              ) : event.typeLabel ? (
                <Badge variant="info" size="sm" soft>
                  {event.typeLabel}
                </Badge>
              ) : null}
            </Box>
          </Flex>

          <AttendeeStack
            names={event.firstAttendees}
            total={event.attendingCount}
            emptyLabel={copy.auth.nobodyYet}
            moreLabel={copy.auth.moreParticipants}
          />

          {event.location ? (
            <Flex gap="2" align="center">
              <Box flexShrink={0} display="flex" color="var(--sm-text-secondary)">
                <MapPinIcon size={14} aria-hidden="true" />
              </Box>
              <Text variant="small" color="muted">
                {event.location}
              </Text>
            </Flex>
          ) : null}

          {/*
            Accordion, not a native <details>: the skills name it as the
            primitive for a disclosure and ban hand-rolled toggles. It also
            costs nothing here — the native version needed thirty lines of
            CSS to look right and gave an 18px tap target.
          */}
          <Accordion type="single" collapsible>
            <AccordionItem value="actions">
              <AccordionTrigger>{copy.common.options}</AccordionTrigger>
              <AccordionContent>
                <EventCardActions
                  eventId={event.id}
                  managePath={event.managePath}
                  whatsAppUrl={event.whatsAppUrl}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Stack>
      </CardContent>
    </Card>
  );
}
