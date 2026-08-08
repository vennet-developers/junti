"use client";

import { useMemo, useState } from "react";


import { Badge } from "@stackmyth/badge";
import { Card, CardContent } from "@stackmyth/card";
import { EmptyState } from "@stackmyth/empty-state";
import { CalendarIcon, LayoutGridIcon, ListIcon, MapPinIcon, SearchIcon } from "@stackmyth/icons";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@stackmyth/input-group";
import { Box, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stackmyth/tabs";
import { Text } from "@stackmyth/text";
import { Toggle, ToggleGroup } from "@stackmyth/toggle";

import { AttendeeStack } from "@/components/attendee-stack";
import { useCopy } from "@/components/copy-provider";
import { useLocalPref } from "@/lib/local-pref";

import { EventCardActions } from "./-event-card-actions";

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
  /** Already formatted, currency and all — or the word for "free". */
  cost: string;
  costPerPerson: boolean;
  isClosed: boolean;
  /** Looking for a new date — said on the card, so nobody plans around it. */
  isPostponed: boolean;
  /** 0–5, hashed from the event type so a kind of event keeps its colour. */
  colorIndex: number;
  attendingCount: number;
  firstAttendees: string[];
  /**
   * How the reader is connected to this event, which decides what the card
   * offers. Sent as a plain string rather than the server's union because the
   * only thing the client does with it is pick a label and a variant.
   */
  role: "organizer" | "in" | "out" | "maybe" | "waitlisted" | "invited";
  /**
   * Null for every event the reader does not own.
   *
   * The manage path contains the organizer token, which is full control of the
   * event. This list now holds events belonging to other people, so the field
   * has to be absent on those — see the `MyEvent` union in `roster.ts`, where
   * the compiler enforces the same thing one layer down.
   */
  managePath: string | null;
  /** The public event page. Where somebody who is merely going wants to go. */
  eventPath: string;
  whatsAppUrl: string;
}

type Filter = "upcoming" | "past" | "all";
type Who = "all" | "organizing" | "joined";
type View = "cards" | "list";

/**
 * Lower-cased and stripped of accents, for comparing.
 *
 * "futbol" has to find "Fútbol". Typing an accent on a phone keyboard means a
 * long press, and almost nobody does it while searching — so a case-only
 * comparison told an organizer that none of their events matched a word that
 * is right there in the title. Both sides are folded, so it works whichever
 * side carries the accent.
 *
 * NFD splits a letter into its base and its mark; the range that follows is
 * the combining marks block, so what is left is the plain letters.
 */
function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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
  /*
    All three selections survive the visit — Ivan asked for the page to
    reopen the way he left it. localStorage through `useLocalPref`, whose
    server snapshot is the default: SSR renders the defaults, hydration
    brings the stored choice, and no effect writes state. Stored values are
    validated against the known sets, so garbage (an old key, a devtools
    edit) falls back instead of selecting nothing.
  */
  const [rawFilter, setFilter] = useLocalPref("junti.events.filter", "upcoming");
  const filter: Filter = rawFilter === "past" || rawFilter === "all" ? rawFilter : "upcoming";
  // The second axis: my ROLE in the event, not its date. "Joined" is every
  // event I did not create — including ones I answered "no" to, because "the
  // events I got into" is a relationship, not an attendance state.
  const [rawWho, setWho] = useLocalPref("junti.events.who", "all");
  const who: Who = rawWho === "organizing" || rawWho === "joined" ? rawWho : "all";
  // A reading preference, not a filter: same events, another density.
  const [rawView, setView] = useLocalPref("junti.events.view", "cards");
  const view: View = rawView === "list" ? "list" : "cards";

  const buckets = useMemo(() => {
    const needle = foldForSearch(term.trim());

    const byRole =
      who === "all"
        ? events
        : events.filter((event) =>
            who === "organizing" ? event.role === "organizer" : event.role !== "organizer",
          );

    const matches = needle
      ? byRole.filter(
          (event) =>
            foldForSearch(event.title).includes(needle) ||
            foldForSearch(event.location ?? "").includes(needle),
        )
      : byRole;

    return {
      // Upcoming reads soonest-first — the next thing you have to think about
      // belongs at the top. Past keeps the newest-first order it arrives in.
      upcoming: matches
        .filter((event) => !event.isPast)
        .sort((a, b) => a.startsAtMs - b.startsAtMs),
      past: matches.filter((event) => event.isPast),
      all: matches,
    };
  }, [events, term, who]);

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
        The two controls that are not about time share a row: on the left,
        which of my events these are (mine to run vs. mine to attend); on the
        right, how densely to read them. Both are ToggleGroups because both
        are single choices that stay on screen — a dropdown would hide the
        state the whole page is being read through.
      */}
      <Flex gap="3" align="center" justify="between" wrap="wrap">
        <ToggleGroup
          type="single"
          variant="outline"
          size="lg"
          value={who}
          onValueChange={(next: string) => {
            if (next) setWho(next);
          }}
        >
          <Toggle value="all">{copy.auth.whoAll}</Toggle>
          <Toggle value="organizing">{copy.auth.whoOrganizing}</Toggle>
          <Toggle value="joined">{copy.auth.whoJoined}</Toggle>
        </ToggleGroup>

        <ToggleGroup
          type="single"
          variant="outline"
          size="lg"
          value={view}
          onValueChange={(next: string) => {
            if (next) setView(next);
          }}
        >
          <Toggle value="cards" aria-label={copy.auth.viewCards}>
            <LayoutGridIcon size={18} aria-hidden="true" />
          </Toggle>
          <Toggle value="list" aria-label={copy.auth.viewList}>
            <ListIcon size={18} aria-hidden="true" />
          </Toggle>
        </ToggleGroup>
      </Flex>

      {/* xl for the touch target, not the type scale: it is the first Tabs
          size whose trigger clears 44px. */}
      <Tabs size="xl" value={filter} onValueChange={(next) => setFilter(next)}>
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
            {shown.length === 0 ? (
              /*
                The empty state stays a single full-width block rather than
                becoming the first cell of a grid. A centred illustration
                occupying the left third of a wide screen, with two empty
                columns beside it, reads as a card that failed to load rather
                than as "there is nothing here".
              */
              <Box pt="4">
                <EmptyState
                  icon={<CalendarIcon size={28} />}
                  title={term.trim() ? copy.auth.noMatches(term.trim()) : emptyCopy[value].title}
                  description={term.trim() ? undefined : emptyCopy[value].description}
                />
              </Box>
            ) : view === "list" ? (
              /*
                The compact reading: one outlined card, one divided row per
                event. Everything a row keeps earned its place by being what
                the list is scanned FOR — title, when/where, role, price and
                the same actions the card offers. What it drops (band colour,
                attendees) is what you open the cards view to browse.
              */
              <Box pt="4">
                <Card surface="outlined" padding="0">
                  <Stack gap="0">
                    {shown.map((event, index) => (
                      <Box key={event.id}>
                        {index > 0 ? <Divider /> : null}
                        <EventRow event={event} />
                      </Box>
                    ))}
                  </Stack>
                </Card>
              </Box>
            ) : (
              /*
                A grid from `md` up, one column below it.

                This is the clearest case in the app for spending width: the
                page is scanned, not read. A season of Thursday football is a
                stripe of one colour running down the list, and the whole point
                of the band is that the pattern is visible at a glance — which
                needs several cards in view at once. One column shows two on a
                laptop; two columns show four.

                Two, and not the three that fit. Three was tried and measured:
                inside this page's 880px container it puts each card at roughly
                285px, and the card is drawn for 448. Titles broke to three
                lines, and the coloured band overlapped itself — the date ran
                straight through "Fiesta infantil". Two columns land each cell
                near 430px, within a rounding error of the width every part of
                this card was designed against, so the density doubles and
                nothing has to be redrawn to pay for it.
              */
              <Grid columns={{ base: "1", md: "2" }} gap="3" pt="4">
                {shown.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </Grid>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Stack>
  );
}

/**
 * One event as a row: the card's facts at reading density.
 *
 * The muted line folds type, date and place into one string because a
 * compact list is scanned down the left edge — every fact that starts its
 * own line would put the next event a line further away. Actions stay,
 * identical to the card's: a denser view of the same list must not cost the
 * things you came to do.
 */
function EventRow({ event }: { event: EventListItem }) {
  const { copy } = useCopy();

  const details = [event.typeLabel ?? copy.auth.eventFallbackLabel, event.when, event.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <Flex px="5" py="3" gap="3" align="center" justify="between" wrap="wrap">
      <Box minWidth="0" flexGrow={1}>
        <Stack gap="1">
          <Flex gap="2" align="center" wrap="wrap">
            <Text weight="semibold">{event.title}</Text>
            <Badge variant={event.role === "organizer" ? "default" : "outline"} size="sm" soft>
              {copy.auth.roles[event.role]}
            </Badge>
            {event.isPostponed ? (
              <Badge variant="warning" size="sm" soft>
                {copy.event.postponedBadge}
              </Badge>
            ) : event.isClosed ? (
              <Badge variant="error" size="sm" soft>
                {copy.event.closedBadge}
              </Badge>
            ) : null}
          </Flex>
          <Text variant="small" color="muted">
            {details}
          </Text>
        </Stack>
      </Box>

      <Flex flexShrink={0} gap="3" align="center" wrap="wrap" justify="end">
        <Text variant="small" weight="semibold" whiteSpace="nowrap">
          {event.cost}
        </Text>
        <EventCardActions
          eventId={event.id}
          managePath={event.managePath}
          eventPath={event.eventPath}
          whatsAppUrl={event.whatsAppUrl}
        />
      </Flex>
    </Flex>
  );
}

/**
 * The bands, in the brand's own tones.
 *
 * These are the five pastel pairs the identity actually ships — the chapitas,
 * plus the soft orange derived for it — rather than Stackmyth's generic
 * `--sm-*-soft` steps, which are the same idea in somebody else's palette. The
 * orange leads because it is the brand's, and the list is read top down.
 *
 * Each pair is a background with the text colour meant to sit on it, and both
 * are redefined for dark mode in `brand-theme.css`, so a band inverts with the
 * page instead of staying a bright strip on a dark card.
 *
 * Colour here says "kind of event", never "state" — the state has a badge two
 * lines below, and the two must not be read as the same signal. Which is why
 * past events leave this palette entirely.
 */
const BANDS = [
  { background: "var(--junti-naranja-suave)", text: "var(--junti-naranja-suave-texto)" },
  { background: "var(--junti-espera-bg)", text: "var(--junti-espera-fg)" },
  { background: "var(--junti-talvez-bg)", text: "var(--junti-talvez-fg)" },
  { background: "var(--junti-viene-bg)", text: "var(--junti-viene-fg)" },
  { background: "var(--junti-error-bg)", text: "var(--junti-error-fg)" },
] as const;

/**
 * A single event at a glance: what, when, who, where, how much.
 *
 * **A coloured band, a body, and a footer split by a torn line.** The band
 * carries the two things you scan a history for — what kind of event it was
 * and when — and its colour is the kind, so a season of Thursday football
 * reads as one stripe running down the list. Past events drop to a grey band:
 * on a list that is mostly history, "already happened" is worth a colour of
 * its own more than a sixth hue is.
 *
 * **The two actions you use every week are visible.** Sharing and managing sit
 * in the footer beside the price; duplicating lives behind the `…`. That
 * replaced a disclosure holding all four, which charged a tap before anything
 * on the card could be done — see {@link EventCardActions}.
 *
 * The card sets `padding="0"` and the regions pad themselves, because a band
 * that stops short of the card's edge is a stripe rather than a header.
 */
function EventCard({ event }: { event: EventListItem }) {
  const { copy } = useCopy();

  /*
    Past events leave the palette for the brand's chip grey. The band still
    exists — the card would lose its shape without one — but it stops competing
    with the ones ahead of you, and on a history that is mostly past that is
    worth more than a sixth hue.

    A named brand token, and not the `--sm-bg-muted` this reached for first:
    that token does not exist, and an undefined custom property makes the whole
    declaration invalid, so the band rendered transparent. Caught by measuring
    the colour, which is the only way that kind of typo announces itself.
  */
  const band = event.isPast
    ? { background: "var(--junti-chip)", text: "var(--junti-texto)" }
    : BANDS[event.colorIndex % BANDS.length];

  return (
    <Card surface="outlined" padding="0">
      <Box backgroundColor={band.background} color={band.text} px="5" py="3">
        {/*
          Wraps rather than collides.

          The band holds two things that both refuse to give ground: the type
          label cannot shrink past its longest word, and the date carries
          `flexShrink={0}` because "8:02 p. m." broken across two lines is not a
          time any more. At 448px — the only width this card had until the
          agenda became a grid — they fit side by side and the conflict never
          came up.

          In a grid cell they do not fit, and `justify="between"` with two
          unshrinkable items does not degrade, it overlaps: the date ran
          straight through "Fiesta infantil". `wrap` gives the date somewhere to
          go, so a narrow card gets two lines instead of two strings sharing the
          same pixels.
        */}
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Box minWidth="0">
            <Text variant="small" weight="semibold" color="inherit">
              {event.typeLabel ?? copy.auth.eventFallbackLabel}
            </Text>
          </Box>
          <Box flexShrink={0}>
            <Text variant="small" weight="medium" color="inherit">
              {event.when}
            </Text>
          </Box>
        </Flex>
      </Box>

      {/*
        Every region pads itself, because `padding="0"` on the Card sets both
        `--sm-card-padding` and `--sm-card-content-padding` — one prop for two
        boxes. Zeroing it to let the band reach the card's edge left the title
        one pixel off the border while the band's own label sat 20px in: two
        left edges inside a single card.

        So the card is three bands of the same `5` inset — colour, body, stub —
        and one full-width rule between the last two. Everything that starts a
        line starts at 20px from the left; everything that ends one ends 20px
        from the right, the badge and the `…` included.
      */}
      <CardContent className="junti-event-card__content">
        {/* Where a stretched card's extra height goes. Without this it
            collected under the stub instead, leaving the torn line and the
            buttons floating mid-card — see `.junti-event-card__content`. */}
        <Stack gap="3" px="5" py="4" flexGrow={1}>
          <Flex justify="between" align="start" gap="3">
            <Box minWidth="0">
              <Text weight="semibold">{event.title}</Text>
            </Box>

            <Flex flexShrink={0} gap="2" align="center" wrap="wrap" justify="end">
              {/*
                Your role, next to the event's state, because they answer two
                different questions that used to have only one answer: this list
                was everything you organized, so the relationship was implied by
                the page. Now it holds other people's events too and the card
                has to say which is which.
              */}
              <Badge variant={event.role === "organizer" ? "default" : "outline"} size="sm" soft>
                {copy.auth.roles[event.role]}
              </Badge>

              {/* Postponed outranks "próximo": the date on this card is the
                  one thing that is no longer true, and saying "próximo"
                  over it would be the card arguing with itself. */}
              {event.isPostponed ? (
                <Badge variant="warning" size="sm" soft>
                  {copy.event.postponedBadge}
                </Badge>
              ) : event.isClosed ? (
                <Badge variant="error" size="sm" soft>
                  {copy.event.closedBadge}
                </Badge>
              ) : (
                <Badge variant={event.isPast ? "secondary" : "success"} size="sm" soft>
                  {event.isPast ? copy.auth.statusPast : copy.auth.statusUpcoming}
                </Badge>
              )}
            </Flex>
          </Flex>

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

          <AttendeeStack
            names={event.firstAttendees}
            total={event.attendingCount}
            emptyLabel={copy.auth.nobodyYet}
            moreLabel={copy.auth.moreParticipants}
          />
        </Stack>

        {/*
          Dashed rather than the solid `Divider`, which draws its line with a
          background colour and so has no style to change. A `Box` border is a
          supported prop taking a token, which keeps the tear out of the
          stylesheet.

          Edge to edge, outside the padded regions on either side of it: a rule
          that stops 20px short is a divider between two paragraphs, and one
          that crosses the whole card is a perforation. The stub below it is
          the part you act on.
        */}
        <Box borderTop="1px dashed var(--sm-border-default)" />

        {/*
          The stub wraps rather than squeezes. Price, two buttons and the `…`
          need 333px; a 390px phone gives the card 318. Every way of closing
          those fifteen pixels made something worse — an icon-only "manage" you
          have to learn, a size below the touch floor, a third action buried —
          so on the narrowest screens the actions take a line of their own,
          still ending flush right. Wider than that it is one row, which is
          what it is on the desktop the list was designed at.
        */}
        <Flex justify="between" align="center" gap="3" px="5" py="4" wrap="wrap">
          {/*
            One line, not two. The amount and "per person" stacked left of a
            row of buttons made the footer lean — a two-line block against a
            one-line one, centred against each other and level with neither.
            Inline, both sides are single rows sharing a centre line.

            Which is why the qualifier is the short form: "Por persona" beside
            a price simply wrapped, and put the second line back. `nowrap`
            keeps it honest — if it ever stops fitting it will show, rather
            than quietly rebuilding the stack this was meant to remove.
          */}
          <Flex gap="2" align="baseline" minWidth="0" wrap="nowrap">
            <Text weight="semibold">{event.cost}</Text>
            {event.costPerPerson ? (
              <Text variant="small" color="muted">
                {copy.money.perPersonShort}
              </Text>
            ) : null}
          </Flex>

          {/* `auto` so the actions take the whole line once they wrap onto
              one, which is what keeps them ending where the badge above them
              does instead of floating in the middle. */}
          <Box flexShrink={0} flexGrow={1} display="flex" justifySelf="end">
            <Flex justify="end" width="100%">
              <EventCardActions
                eventId={event.id}
                managePath={event.managePath}
                eventPath={event.eventPath}
                whatsAppUrl={event.whatsAppUrl}
              />
            </Flex>
          </Box>
        </Flex>
      </CardContent>
    </Card>
  );
}
