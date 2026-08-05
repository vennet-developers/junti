import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Container, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { TrackView } from "@/components/track-view";
import { Link } from "@tanstack/react-router";
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/config/brand";
import { ROUTES } from "@/config/routes";

/**
 * A signed-in organizer has no use for the pitch: they came back to look at
 * their events, so send them there. The session middleware has already
 * refreshed the cookie by the time this runs, so an organizer whose token had
 * expired is not silently treated as a stranger.
 */
const gate = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getOrganizer }, { getViewerCopy }] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/locale"),
  ]);

  if (await getOrganizer()) {
    throw redirect({ to: ROUTES.myEvents as never });
  }

  const { copy } = await getViewerCopy();

  // Absolute, because Open Graph and JSON-LD both require it — a relative
  // image URL in a card is an image no scraper can fetch.
  const { origin } = await import("@/lib/urls");

  return { title: copy.home.title, origin: await origin() };
});

export const Route = createFileRoute("/")({
  loader: () => gate(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin ?? "";
    const title = loaderData?.title ?? BRAND_NAME;

    /*
      The card the link becomes when somebody shares it.

      This product spreads by one person pasting a link into a group chat, so
      the preview WhatsApp draws is not a marketing detail — it is the first
      thing most people will ever see of Junti. A link with no card is a grey
      rectangle and a URL.

      The image is the brand mark rather than a screenshot: a screenshot of an
      event page would be somebody's roster, and a mock one goes stale the
      first time the UI changes.
    */
    const image = `${origin}/brand/junti-chapa-principal.png`;

    return {
      meta: [
        { title },
        { name: "description", content: BRAND_DESCRIPTION },

        { property: "og:type", content: "website" },
        { property: "og:site_name", content: BRAND_NAME },
        { property: "og:title", content: title },
        { property: "og:description", content: BRAND_DESCRIPTION },
        { property: "og:url", content: `${origin}/` },
        { property: "og:image", content: image },
        { property: "og:locale", content: "es_CO" },

        // `summary_large_image` rather than `summary`: the small card crops to
        // a square and the mark is wider than it is tall.
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: BRAND_DESCRIPTION },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: `${origin}/` }],
      scripts: [
        {
          type: "application/ld+json",
          /*
            `WebApplication` rather than `Organization`: what somebody searching
            would want to find is the thing they can use, not the company. No
            `offers` block — pricing is a positioning decision that has not been
            made, and the card's own guidance says omitting it beats inventing
            it.
          */
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: BRAND_NAME,
            description: BRAND_DESCRIPTION,
            url: `${origin}/`,
            applicationCategory: "LifestyleApplication",
            operatingSystem: "Any",
            inLanguage: "es-CO",
          }),
        },
      ],
    };
  },
  component: HomePage,
});

function HomePage() {
  const { copy } = useCopy();

  return (
    /*
      Always signed out: the loader redirects account holders to their events,
      so this only ever renders for a visitor.

      `size="3"` rather than the `size="2"` this shipped with. The width policy
      in globals.css grants width to screens that are SCANNED and withholds it
      from screens that are READ — and a landing page is neither. It is
      scanned first and read second, and at 688px it was rendering as a form
      with a headline on top: one narrow column down the middle of a monitor,
      which is what made it read as unfinished rather than as a front page.
      The prose inside it stays capped by measure, so nothing gets a longer
      line than it should.
    */
    <Container size="3" px="4" py={{ base: "7", md: "8" }}>
      <Stack gap={{ base: "7", md: "8" }}>
        {/* AC-8: the top of the organizer funnel. Without it, `create_started`
            has no denominator and "how many people who landed here made an
            event" is unanswerable. */}
        <TrackView name="landing_viewed" />

        {/* ── The hero ─────────────────────────────────────────────────────
            One column, centred at nothing — left-aligned, because a centred
            hero needs artwork to balance it and this product has a wordmark
            and a sentence. The kicker goes above the heading rather than
            below: "free, no passwords" is the objection somebody is already
            forming, and answering it before the pitch costs one line. */}
        <Stack gap="4" maxWidth="46rem">
          {/* `Text` has no `color="brand"` — the token exists as
              `--sm-text-brand` and the prop cannot reach it (STACKMYTH-GAPS
              #25). A `Box` carrying the colour is the composition that works
              without a style attribute. */}
          <Box color="var(--sm-text-brand)">
            {/* `color="inherit"` is the load-bearing half: without it `Text`
                paints its own default and the Box's colour never reaches it. */}
            <Text as="span" variant="small" weight="semibold" color="inherit">
              {copy.home.heroKicker}
            </Text>
          </Box>

          {/* The tagline is the heading, not the brand name: the header says
              "Junti" one line above, and repeating it as <h1> reads as a
              stutter. */}
          <Text as="h1" variant="h1" fontFamily="var(--junti-display)">
            {copy.home.subheading}
          </Text>

          {/* Capped tighter than the heading. A 46rem line of body text is
              past the comfortable measure; a heading at that width is fine,
              because it is three or four words. */}
          <Box maxWidth="36rem">
            <Text>{copy.home.pitch}</Text>
          </Box>

          <Flex gap="3" wrap="wrap" pt="2">
            <Box width={{ base: "100%", sm: "auto" }}>
              <Button asChild size="lg" fullWidth>
                <Link to={ROUTES.newEvent}>{copy.home.cta}</Link>
              </Button>
            </Box>
            {/* Secondary on purpose: both destinations ask for the same
                account, so the primary is the one that says what this is for. */}
            <Box width={{ base: "100%", sm: "auto" }}>
              <Button asChild size="lg" variant="secondary" fullWidth>
                <Link to={ROUTES.myEvents}>{copy.home.heroSecondary}</Link>
              </Button>
            </Box>
          </Flex>
        </Stack>

        <Divider />

        {/* ── Three reasons ────────────────────────────────────────────────
            Not a feature list. Three questions somebody organizing something
            on a Thursday already has, in the order they hurt: who is coming,
            who has paid, and what it costs the people you are inviting. */}
        <Stack gap="4">
          <Text as="h2" variant="h3" fontFamily="var(--junti-display)">
            {copy.home.featuresTitle}
          </Text>

          <Grid columns={{ base: "1", md: "repeat(3, 1fr)" }} gap="4" align="stretch">
            {copy.home.features.map((feature) => (
              /* No height prop needed: `align="stretch"` on the grid makes
                 every cell the height of the tallest, and the card IS the
                 cell — so three blocks of unequal copy still line up at the
                 bottom edge. `Card` exposes no height of its own anyway. */
              <Card key={feature.title} surface="outlined">
                <CardContent>
                  <Stack gap="2">
                    <Text as="h3" variant="h5" fontFamily="var(--junti-display)">
                      {feature.title}
                    </Text>
                    <Text variant="small" color="muted">
                      {feature.body}
                    </Text>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Grid>
        </Stack>

        {/* ── How it works ─────────────────────────────────────────────────
            Full width, with the steps in two columns once there is room. The
            first version put the steps beside the money caveat and left the
            caveat's column mostly empty — a two-line card holding open a
            half-page of nothing, which draws the eye to the gap rather than to
            the words. Stacking them gives the caveat the full measure and the
            steps a shape that fits four items. */}
        <Stack gap="4">
          <Text as="h2" variant="h3" fontFamily="var(--junti-display)">
            {copy.home.howItWorksTitle}
          </Text>

          {/* No dividers: four numbered steps already read as a sequence, and
              rules here would stack against the card's own border below. */}
          <Grid columns={{ base: "1", md: "repeat(2, 1fr)" }} gap={{ base: "2", md: "4" }}>
            {copy.home.steps.map((step: string, index: number) => (
              <Flex key={step} gap="3" align="baseline">
                <Box color="var(--sm-text-brand)" flexShrink={0}>
                  <Text as="span" variant="small" weight="semibold" color="inherit">
                    {index + 1}
                  </Text>
                </Box>
                <Text>{step}</Text>
              </Flex>
            ))}
          </Grid>

          {/*
            The money caveat, its own card and never softened. It is the single
            most important thing on this page for anybody deciding whether to
            trust it with a group's money, and burying it in small print would
            be the exact opposite of what it says. Full width now, so it reads
            as a statement rather than as a note in a margin.
          */}
          <Card surface="outlined">
            <CardContent>
              <Text color="muted">{copy.home.disclaimer}</Text>
            </CardContent>
          </Card>
        </Stack>

        {/* ── The close ────────────────────────────────────────────────────
            The same action once more, for somebody who read to the bottom.
            One button, not two: whoever is still here has stopped comparing
            options. */}
        <Stack gap="3" maxWidth="36rem">
          <Text as="h2" variant="h3" fontFamily="var(--junti-display)">
            {copy.home.closingTitle}
          </Text>
          <Text color="muted">{copy.home.closingBody}</Text>
          {/* A Flex, not a Box: a block-level wrapper set to `auto` is still
              100% of its parent, so `fullWidth` stretched this to the full
              36rem measure and the button stopped reading as a button. As a
              flex item it shrinks to its label, and still fills the width on a
              phone where the thumb wants the whole row. */}
          <Flex pt="1">
            <Box width={{ base: "100%", sm: "auto" }}>
              <Button asChild size="lg" fullWidth>
                <Link to={ROUTES.newEvent}>{copy.home.cta}</Link>
              </Button>
            </Box>
          </Flex>
        </Stack>
      </Stack>
    </Container>
  );
}
