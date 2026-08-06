import { Box, Container, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { Link } from "@tanstack/react-router";

import { Chapa } from "@/components/chapa";
import { useCopy } from "@/components/copy-provider";
import { ROUTES } from "@/config/routes";

/**
 * The footer: what this is, where else to go, and who made it.
 *
 * **It used to be a logo and a copyright line**, which was honest and left the
 * two legal pages unreachable — `/privacy` was linked from exactly one place, a
 * line inside the onboarding form that anybody signing in with Google never
 * saw. A page written to be found could not be found. That is what this fixes;
 * looking like a real product's footer is the other half.
 *
 * **Three columns from `md`, one on a phone, and the order is the phone's.**
 * The brand block comes first because somebody who lands in the footer of a
 * privacy notice may never have seen the front page and needs one sentence
 * saying what they are reading about. Then the two short lists.
 *
 * **The same footer on every screen, including the app.** A separate marketing
 * footer for public pages and a compact one inside was the obvious alternative
 * and it is a worse trade: two components that must stay in step, and a person
 * who wants the privacy notice while logged in is exactly as entitled to find
 * it. It stays quiet by being made of small muted type rather than by having
 * less in it.
 *
 * **The bottom bar carries the attribution**, unchanged and for the unchanged
 * reasons: the Vennet mark rather than the wordmark, because only the mark is
 * real artwork — the wordmark is `<text>` asking for a face this app does not
 * ship, so it would paint in whatever the device had lying around. 222 bytes of
 * vector, no font anywhere near it, and the same lesson Junti learned about its
 * own chapa: a logo must not need a font.
 *
 * **Junti's palette for the type, Vennet's for the mark.** The attribution is a
 * credit on somebody else's page, not a co-brand, so the sentence uses this
 * app's muted text while the mark keeps its own ink — a logo redrawn in the
 * host's colours is no longer the logo.
 *
 * **At the bottom of the viewport without sticking to it.** The body is a
 * column at least a screen tall and a spacer above eats the leftover height, so
 * this lands on the bottom edge of a short page and simply follows the content
 * on a long one. Which is the difference from `position: fixed`: it never
 * covers the page, and on a phone it cannot land on the button somebody is
 * reaching for.
 */
export function AppFooter() {
  /*
    From the provider, not from `getViewerCopy()`. Under Next this was an async
    server component and reading the cookie machinery directly was free; under
    TanStack the shell hydrates, so a footer importing the preferences module
    would drag the database client into the browser — the tripwire caught
    exactly that on this file's first render.
  */
  const { copy } = useCopy();

  // Server-rendered on first paint, so the year comes from the server's clock;
  // hydration re-runs it with the same value.
  const year = new Date().getFullYear();

  return (
    /*
      A tinted surface, not paper. The footer sat on exactly the same
      background as the page and was separated from it by one hairline, which
      is why it read as "more page" rather than as the end of one — and on the
      landing, where the section above it is a full orange band, that hairline
      disappeared entirely.

      `--junti-chip` rather than ink. A dark footer is the obvious "make it
      look professional" move and it would be wrong here: this component
      renders on every screen in the app, not just the landing, and a black
      slab under a roster is a heavier ending than the roster deserves.
    */
    /*
      No top margin any more. It existed to separate a paper footer from a
      paper page, and the tint does that job now — on the landing the margin
      showed up as a stripe of page between the closing orange band and the
      footer, which read as a gap rather than as an edge. Short pages still
      push this to the bottom: that comes from the spacer in the root layout,
      not from here.
    */
    <Box as="footer" backgroundColor="var(--junti-chip)">
      {/* The same frame width as the header, for the same reason: the shell
          belongs to the app, not to whichever page is under it. */}
      <Container size="4" px="4">
        <Stack gap={{ base: "5", md: "6" }} py={{ base: "6", md: "7" }}>
          {/*
            `1fr` against `auto`: the brand block takes the slack and the two
            link lists are exactly as wide as their longest label. Two equal
            halves would leave the lists floating in space they have no content
            for.

            **The lists are their own grid, two columns at EVERY width.**
            Measured at a real 390px viewport, stacking all three blocks made
            this footer 539px tall — 64% of a phone screen, for furniture.
            Side by side they fit in one band and the whole thing drops to
            roughly a third of that.
          */}
          <Grid columns={{ base: "1", md: "1fr auto" }} gap={{ base: "5", md: "7" }} align="start">
            <Stack gap="3" maxWidth="26rem">
              {/* The chapa, not the wordmark — same rule as the header, and the
                  brand allows one per screen. This is the footer's, and the
                  header's is a screen away by the time anybody reads it. */}
              <Box>
                <Link to={ROUTES.home} className="brand-link">
                  <Chapa width={72} />
                </Link>
              </Box>

              <Text variant="small" color="muted">
                {copy.footer.blurb}
              </Text>

            </Stack>

            <Grid columns="repeat(2, auto)" gap={{ base: "4", md: "7" }} align="start">
              <FooterColumn heading={copy.footer.productHeading}>
                <FooterLink to={ROUTES.newEvent}>{copy.home.cta}</FooterLink>
                <FooterLink to={ROUTES.welcome}>{copy.welcome.link}</FooterLink>
                <FooterLink to={ROUTES.myEvents}>{copy.auth.myEventsLink}</FooterLink>
              </FooterColumn>

              <FooterColumn heading={copy.footer.legalHeading}>
                <FooterLink to={ROUTES.privacy}>{copy.footer.privacyLink}</FooterLink>
                <FooterLink to={ROUTES.terms}>{copy.footer.termsLink}</FooterLink>
                {/*
                  A real mailto rather than a contact form. The privacy notice
                  and the terms both name this address as the way to exercise a
                  right or file a complaint, and a form that could silently fail
                  would be the worst possible thing to put behind that promise.
                */}
                <FooterLink href="mailto:hello@vennet.dev">{copy.footer.contactCta}</FooterLink>
              </FooterColumn>
            </Grid>
          </Grid>

          <Divider />

          {/*
            The bottom bar. Stacked on a phone and split on a laptop — the
            copyright reads first in both, because the mark beside it is a
            credit rather than a heading.
          */}
          <Flex
            direction={{ base: "column", md: "row" }}
            justify="between"
            align="center"
            gap="4"
          >
            <Text variant="small" color="muted" align="center">
              {copy.footer.legal(year)}
            </Text>

            {/*
              A plain <a>: it leaves the app entirely, and a client-side
              transition to another origin is not a thing. Plain <img> for the
              same reason the chapa is one — the optimizer is for photographs it
              can resize, and this is one vector that renders at every size. The
              120x27 viewBox sets the box so nothing shifts while it loads.

              Empty alt: the link already carries the name through
              `aria-label`, and announcing "Vennet" twice is how a logo link
              reads to a screen reader otherwise.
            */}
            <a
              href="https://vennet.dev"
              rel="noopener noreferrer"
              aria-label={copy.footer.vennetLabel}
              className="vennet-mark"
            >
              <img
                src="/brand/vennet-mark-ink.svg"
                alt=""
                width={80}
                height={18}
                className="vennet-mark__art vennet-mark__art--light"
              />
              <img
                src="/brand/vennet-mark-white.svg"
                alt=""
                width={80}
                height={18}
                className="vennet-mark__art vennet-mark__art--dark"
              />
            </a>
          </Flex>
        </Stack>
      </Container>
    </Box>
  );
}

/** One labelled list. A heading and its links, nothing else. */
function FooterColumn({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Stack gap="3" minWidth="0">
      {/*
        `h2` is wrong here — these are not sections of the page, they are labels
        on a navigation list, and an outline that ends with "Producto / Legal"
        below a privacy notice reads as two more chapters. A styled span keeps
        the look and leaves the document structure alone.
      */}
      <Text as="span" variant="small" weight="semibold">
        {heading}
      </Text>
      <Stack gap="2">{children}</Stack>
    </Stack>
  );
}

/**
 * A destination in a footer column.
 *
 * **The padding is on the ANCHOR, not around it**, and that is the whole reason
 * this is a component rather than a `Text` wrapping a link. Measured at a real
 * 390px viewport these were 16px tall — a sixteen-pixel tap target in an app
 * that raised `--sm-density-factor` to 1.4 specifically so nothing would be
 * under 44 (DECISIONS.md #32). Padding on a wrapper would have moved the text
 * and left the hit area exactly as small.
 *
 * A class, and it has to be one. `Box as={Link}` would have put the padding on
 * the anchor without any CSS, but `Box` does not forward the router's `to` — so
 * the choice was a class or giving up client-side navigation in the footer.
 * `.junti-footer-link` deliberately does NOT start with `sm-`, which is what
 * keeps the app's link-colour rule applying to it; see globals.css.
 *
 * Takes either a router destination or an `href`, because one of the three is a
 * `mailto:` and the router has no opinion about those.
 */
function FooterLink({
  to,
  href,
  children,
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
}) {
  const content = (
    <Text as="span" variant="small" color="inherit">
      {children}
    </Text>
  );

  /* `to` is typed as a plain string rather than the router's union: every
     destination is a `ROUTES` constant, and threading the literal types
     through a wrapper buys nothing the call site would not already catch. */
  return href ? (
    <a href={href} className="junti-footer-link">
      {content}
    </a>
  ) : (
    <Link to={to as never} className="junti-footer-link">
      {content}
    </Link>
  );
}
