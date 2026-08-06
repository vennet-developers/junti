import { Button } from "@stackmyth/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@stackmyth/accordion";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Container, Flex, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { LandingVisual, PlanStrip } from "@/components/landing-visual";
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

  /*
    The proof numbers, or null. `loadLandingStats` returns null below its own
    floor rather than zeroes, so this page cannot accidentally render an empty
    "look how popular we are" block — see its note for why the floor is there.
  */
  const { loadLandingStats } = await import("@/lib/landing-stats");

  return { title: copy.home.title, origin: await origin(), stats: await loadLandingStats() };
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

/**
 * A full-width band of colour, with the page's own frame inside it.
 *
 * **This is what the page was missing.** Everything sat inside one `Container`
 * on one paper background, so eight sections read as one very long section —
 * nothing told the eye where a thought ended. A band breaks the page into
 * chapters without a single divider.
 *
 * The colour goes on an outer `Box` and the container lives inside it, because
 * a band that stops at the content's width is not a band, it is a card. This
 * is the only pattern on the page that needs to escape the frame.
 */
function Band({
  tone = "paper",
  children,
}: {
  tone?: "paper" | "tint" | "ink" | "brand";
  children: React.ReactNode;
}) {
  /*
    `--junti-tinta-fija` and `--junti-papel-fijo` rather than the inverting
    pair. `--junti-tinta` flips to near-white in dark mode, which is correct
    for body text and catastrophic for a band that is dark ON PURPOSE — the
    section would simply disappear into the page. The "fija" tokens exist for
    exactly this and brand-theme.css says so.
  */
  const surface = {
    paper: undefined,
    tint: "var(--junti-chip)",
    ink: "var(--junti-tinta-fija)",
    brand: "var(--junti-naranja)",
  }[tone];

  const ink = {
    paper: undefined,
    tint: undefined,
    ink: "var(--junti-papel-fijo)",
    // Ink on orange, never paper: the brand rule is that the chapa's orange
    // carries dark type, and #ff7a3d against white is 2.1:1.
    brand: "var(--junti-tinta-fija)",
  }[tone];

  return (
    <Box backgroundColor={surface} color={ink} py={{ base: "7", md: "8" }}>
      <Container size="4" px="4">
        {children}
      </Container>
    </Box>
  );
}

/**
 * A titled block, so every section on this page opens the same way.
 *
 * The reference layout this page's structure comes from repeats one pattern —
 * small label, then the sentence, then the content — and that repetition is
 * most of what makes a long page feel composed rather than accumulated. It is a
 * component so the rhythm cannot drift section by section.
 *
 * `color="inherit"` on the subtitle rather than `muted`: inside an ink band the
 * muted token resolves against the PAGE, not against the band, and the line
 * came out nearly invisible. Opacity on the band's own foreground keeps the
 * hierarchy without needing a second palette.
 */
function Section({
  eyebrow,
  title,
  onInk = false,
  children,
}: {
  eyebrow: string;
  title: string;
  onInk?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="5">
      <Stack gap="2" maxWidth="42rem">
        <Text as="h2" variant="h3" fontFamily="var(--junti-display)" color="inherit">
          {eyebrow}
        </Text>
        <Box opacity={onInk ? 0.75 : undefined}>
          <Text color={onInk ? "inherit" : "muted"}>{title}</Text>
        </Box>
      </Stack>
      {children}
    </Stack>
  );
}

/**
 * One real number and what it counts.
 *
 * Formatted with `Intl` rather than by hand: at four digits a thousands
 * separator is the difference between a number and a string of digits, and
 * which separator is correct depends on the reader's language.
 */
function Metric({ value, label }: { value: number; label: string }) {
  const { copy } = useCopy();

  return (
    <Stack gap="0">
      <Text as="span" variant="h2" weight="bold" fontFamily="var(--junti-display)" color="inherit">
        {new Intl.NumberFormat(copy.intlLocale).format(value)}
      </Text>
      <Box opacity={0.7}>
        <Text variant="small" color="inherit">
          {label}
        </Text>
      </Box>
    </Stack>
  );
}

function HomePage() {
  const { copy } = useCopy();
  const { stats } = Route.useLoaderData();

  const cta = (
    <Box width={{ base: "100%", sm: "auto" }}>
      <Button asChild size="lg" fullWidth>
        <Link to={ROUTES.newEvent}>{copy.home.cta}</Link>
      </Button>
    </Box>
  );

  return (
    /*
      No page-level Container any more, and that is the structural change.
      Every section is a {@link Band} that spans the viewport and brings the
      frame inside it, so colour can run edge to edge while the words stay on
      the same 1136px grid as the header and the footer.
    */
    <Box>
      {/* AC-8: the top of the organizer funnel. Without it, `create_started`
          has no denominator and "how many people who landed here made an
          event" is unanswerable. */}
      <TrackView name="landing_viewed" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Band>
        <Grid columns={{ base: "1", lg: "1.15fr 0.85fr" }} gap={{ base: "6", lg: "8" }} align="center">
          <Stack gap="4">
            {/* `Text` has no `color="brand"` — the token exists as
                `--sm-text-brand` and the prop cannot reach it (STACKMYTH-GAPS
                #25). A `Box` carrying the colour is the composition that works
                without a style attribute. */}
            <Box color="var(--sm-text-brand)">
              <Text as="span" variant="small" weight="semibold" color="inherit">
                {copy.home.heroKicker}
              </Text>
            </Box>

            {/*
              Not the brand name: the header says "Junti" one line above.
              Two beats inside one <h1>, so the outline stays a single heading
              — "Un link." has to land as a finished thing before the payoff.
            */}
            <Text as="h1" variant="h1" fontFamily="var(--junti-display)">
              {copy.home.heroTitle}
              <Box display="block">{copy.home.heroTitleSecond}</Box>
            </Text>

            <Box maxWidth="36rem">
              <Text>{copy.home.pitch}</Text>
            </Box>

            <Flex gap="3" wrap="wrap" pt="2">
              {cta}
              <Box width={{ base: "100%", sm: "auto" }}>
                <Button asChild size="lg" variant="secondary" fullWidth>
                  <Link to={ROUTES.myEvents}>{copy.home.heroSecondary}</Link>
                </Button>
              </Box>
            </Flex>
          </Stack>

          <LandingVisual copy={copy} />
        </Grid>
      </Band>

      {/*
        The plan strip, full bleed and with no padding of its own — the one
        element on the page that touches both edges. Six photographs running
        the width of the screen say "this is for football, dinners, bowling,
        padel" faster than the sentence that would replace them.
      */}
      <PlanStrip copy={copy} />

      {/* ── The pain ─────────────────────────────────────────────────────── */}
      <Band>
        <Section eyebrow={copy.home.painTitle} title={copy.home.painBody}>
          <Grid columns={{ base: "1", md: "repeat(3, 1fr)" }} gap="4" align="stretch">
            {copy.home.pains.map((pain) => (
              <Card key={pain.title} surface="outlined">
                <CardContent>
                  <Stack gap="2">
                    <Text as="h3" variant="h5" fontFamily="var(--junti-display)">
                      {pain.title}
                    </Text>
                    <Text variant="small" color="muted">
                      {pain.body}
                    </Text>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Grid>
        </Section>
      </Band>

      {/* ── What it is for ───────────────────────────────────────────────── */}
      <Band tone="tint">
        <Section eyebrow={copy.home.featuresTitle} title={copy.home.featuresBody}>
          <Grid columns={{ base: "1", md: "repeat(3, 1fr)" }} gap="4" align="stretch">
            {copy.home.features.map((feature) => (
              /* `solid` rather than `outlined` here: on the tinted band an
                 outlined card is a rectangle of the same colour as its
                 surroundings with a line around it. A filled card lifts. */
              <Card key={feature.title} surface="solid">
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
        </Section>
      </Band>

      {/* ── How it works ───────────────────────────────────────────────────
          Two columns from `lg`: the four steps beside a photograph. This
          section was the last block on the page with no image at all, and it
          showed — a wall of numbered lines between two picture-heavy bands.
          The photo is a plan mid-flight, which is what the steps describe. */}
      <Band>
        <Grid columns={{ base: "1", lg: "1.1fr 0.9fr" }} gap={{ base: "6", lg: "8" }} align="center">
        <Stack gap="4">
          <Text as="h2" variant="h3" fontFamily="var(--junti-display)">
            {copy.home.howItWorksTitle}
          </Text>

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

          <Card surface="outlined">
            <CardContent>
              <Text color="muted">{copy.home.disclaimer}</Text>
            </CardContent>
          </Card>
        </Stack>

          <Box overflow="hidden" borderRadius="var(--sm-radius-lg)" aspectRatio="4 / 3">
            <img
              src="/landing/cena-terraza.webp"
              srcSet="/landing/cena-terraza@sm.webp 450w, /landing/cena-terraza.webp 900w"
              sizes="(min-width: 64rem) 40vw, 100vw"
              alt={copy.home.stepsImageAlt}
              width={900}
              height={600}
              loading="lazy"
              decoding="async"
              className="landing-photo"
            />
          </Box>
        </Grid>
      </Band>

      {/*
        ── Why you can trust it ──────────────────────────────────────────────
        The ink band, and the page's centre of gravity. Where the reference
        layout puts a personal-brand "about me", this puts the three decisions
        that make the product trustworthy — and it is dark because that is the
        moment the page stops selling and starts committing.

        The photograph earns its place by being the only human face in a
        section about money and consent. Two friends, nothing staged about a
        product.
      */}
      <Band tone="ink">
        <Grid columns={{ base: "1", lg: "0.8fr 1.2fr" }} gap={{ base: "6", lg: "8" }} align="center">
          <Box overflow="hidden" borderRadius="var(--sm-radius-lg)" className="landing-hero-frame">
            <img
              src="/landing/amigos.webp"
              srcSet="/landing/amigos@sm.webp 450w, /landing/amigos.webp 900w"
              sizes="(min-width: 64rem) 30vw, 100vw"
              alt={copy.home.trustImageAlt}
              width={900}
              height={600}
              loading="lazy"
              decoding="async"
              className="landing-photo"
            />
          </Box>

          <Section
            eyebrow={copy.home.differenceTitle}
            title={copy.home.differenceBody}
            onInk
          >
            <Stack gap="4">
              {/* A Flex, not a Grid. `columns="auto 1fr"` left the number
                  column ~280px wide — the `auto` track did not shrink to its
                  content the way the equivalent CSS would, and the numbers
                  ended up marooned a third of the way across the band. A flex
                  item shrink-wraps, which is all this ever needed. */}
              {copy.home.differences.map((item, index) => (
                <Flex key={item.title} gap="4" align="baseline">
                  {/* The brand orange, not the link colour: on ink #FF7A3D is
                      the readable one and #B6541A is not. */}
                  <Box color="var(--junti-naranja)" flexShrink={0}>
                    <Text as="span" variant="h4" weight="bold" color="inherit">
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                  </Box>
                  <Stack gap="1">
                    <Text as="h3" variant="h5" fontFamily="var(--junti-display)" color="inherit">
                      {item.title}
                    </Text>
                    <Box opacity={0.75}>
                      <Text color="inherit">{item.body}</Text>
                    </Box>
                  </Stack>
                </Flex>
              ))}
            </Stack>

            {/*
              The real numbers, inside the same band. They belong with the
              trust argument rather than in a strip of their own — a count is
              evidence for a claim, and putting it next to the claim is what
              makes it read as one. Hidden entirely below the floor; see
              `loadLandingStats`.
            */}
            {stats ? (
              <>
                <Box pt="3" />
                <Grid columns={{ base: "1", sm: "repeat(3, 1fr)" }} gap="4">
                  <Metric value={stats.events} label={copy.home.statsEvents} />
                  <Metric value={stats.answers} label={copy.home.statsAnswers} />
                  <Metric value={stats.payments} label={copy.home.statsPayments} />
                </Grid>
              </>
            ) : null}
          </Section>
        </Grid>
      </Band>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Band>
        <Stack gap="4" maxWidth="52rem">
          <Text as="h2" variant="h3" fontFamily="var(--junti-display)">
            {copy.home.faqTitle}
          </Text>

          <Accordion type="single" collapsible defaultValue="faq-0">
            {copy.home.faqs.map((item, index) => (
              <AccordionItem key={item.q} value={`faq-${index}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>
                  <Text color="muted">{item.a}</Text>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Stack>
      </Band>

      {/*
        ── The close ────────────────────────────────────────────────────────
        The orange band, used exactly once. It is the loudest surface the brand
        has, and spending it anywhere but the last ask would leave the last ask
        quieter than something above it.
      */}
      <Band tone="brand">
        <Stack gap="3" maxWidth="40rem">
          <Text as="h2" variant="h2" fontFamily="var(--junti-display)" color="inherit">
            {copy.home.closingTitle}
          </Text>
          <Box opacity={0.8}>
            <Text color="inherit">{copy.home.closingBody}</Text>
          </Box>
          <Flex pt="2">{cta}</Flex>
        </Stack>
      </Band>
    </Box>
  );
}
