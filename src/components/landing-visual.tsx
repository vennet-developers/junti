import { Avatar, AvatarFallback } from "@stackmyth/avatar";
import { Badge } from "@stackmyth/badge";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";

/**
 * A photograph of a real plan, with the product sitting on top of it.
 *
 * **The photo alone would have been decoration.** The landing's problem was
 * that somebody arriving had to READ to find out what this is — a page of type
 * on paper, on a phone, from a WhatsApp link. A stock photo of people having
 * fun fixes the mood and answers nothing; what answers it is seeing the thing
 * the product actually produces. So the card is not an illustration of a
 * roster, it is built from the same components the roster is built from, in
 * the same colours the app uses for those states.
 *
 * The two are one idea: the photo says WHO this is for, the card says WHAT you
 * get. Neither works alone here.
 *
 * **Absolutely positioned, and only from `md`.** Overlapping a card onto a
 * photograph needs room the phone does not have — at 390px the card would
 * cover the faces, which is the half of the image doing the work. On a phone
 * the two stack, and the composition becomes "photo, then card", which reads
 * fine and costs nothing.
 */
export function LandingVisual({ copy }: { copy: Copy }) {
  return (
    <Box position="relative" width="100%">
      {/*
        `aspectRatio` on the frame rather than a height on the image: the box is
        reserved before the file arrives, so nothing below it jumps when the
        photo loads. That is the whole of this page's layout-shift risk.
      */}
      <Box overflow="hidden" borderRadius="var(--sm-radius-lg)" className="landing-hero-frame">
        {/*
          A plain <img>, deliberately. There is no image optimizer in this app
          and the file is already a 122 KB WebP; routing it through anything
          would add a request and change nothing about the bytes.

          `fetchPriority="high"` plus no lazy loading: this is the LCP element
          on the one page whose card names an LCP budget. Everything else on
          the page is lazy — see `PlanStrip`.

          `srcSet` so a phone fetches the 600px file (32 KB) instead of the
          1200px one. `sizes` tells the browser which before layout exists,
          which is the only way it can choose correctly on the first pass.
        */}
        <img
          src="/landing/futbol-selfie.webp"
          srcSet="/landing/futbol-selfie@sm.webp 600w, /landing/futbol-selfie.webp 1200w"
          sizes="(min-width: 48rem) 40vw, 100vw"
          alt={copy.home.heroImageAlt}
          width={1200}
          height={1800}
          fetchPriority="high"
          className="landing-photo"
        />
      </Box>

      {/*
        The product, overlapping the photograph's bottom edge from `md`.
        A class, not props: `position`, `aspectRatio` and the offsets are the
        few layout properties Stackmyth does NOT accept as `Responsive<T>`, so
        "static on a phone, absolute from md" cannot be expressed as a prop.
        `.gated-preview__card` is the existing precedent for exactly this.
        STACKMYTH-GAPS.md #27.
      */}
      <Box className="landing-hero-card" width="100%" mt={{ base: "3", md: "0" }}>
        <Card surface="elevated">
          <CardContent>
            <Stack gap="3">
              <Stack gap="0">
                <Text as="span" variant="small" color="muted">
                  {copy.home.heroCardKicker}
                </Text>
                <Text as="span" weight="semibold" fontFamily="var(--junti-display)">
                  {copy.home.heroCardTitle}
                </Text>
              </Stack>

              {/*
                Initials, not photographs. Faces here would be a second set of
                strangers stacked on the first, and the roster in the real app
                shows initials for anybody who signed in by email anyway.
              */}
              <Flex gap="2" align="center" wrap="wrap">
                {copy.home.heroCardPeople.map((person) => (
                  <Avatar key={person} size="sm">
                    <AvatarFallback name={person} />
                  </Avatar>
                ))}
                <Text variant="small" color="muted">
                  {copy.home.heroCardCount}
                </Text>
              </Flex>

              {/*
                The real state colours. `success` and `warning` resolve to
                `--junti-viene-*` and `--junti-talvez-*` through brand-theme.css,
                so these are not "green and amber" — they are the exact chips
                somebody sees on their own event.
              */}
              <Flex gap="2" wrap="wrap">
                <Badge variant="success" size="sm" soft>
                  {copy.attendance.in}
                </Badge>
                <Badge variant="warning" size="sm" soft>
                  {copy.attendance.maybe}
                </Badge>
                <Badge variant="secondary" size="sm" soft>
                  {copy.home.heroCardPaid}
                </Badge>
              </Flex>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

/**
 * What a "plan" looks like, six times.
 *
 * The single most direct answer to "does somebody landing here know what this
 * is for?" — and the reason it is photographs rather than a sentence listing
 * the kinds of event. "Fútbol, comidas, bolos, pádel" is a list somebody skims;
 * six images of exactly those is understood before it is read.
 *
 * All lazy and all below the fold. The hero image is the only one that competes
 * for the LCP budget.
 */
export function PlanStrip({ copy }: { copy: Copy }) {
  return (
    <Box overflow="hidden" borderRadius="var(--sm-radius-lg)">
      {/*
        Three columns on a phone, six on a laptop — one band either way rather
        than a grid that reflows into a wall of photographs. `gap="1"` keeps it
        reading as a single strip.
      */}
      <Flex gap="1" wrap="nowrap">
        {copy.home.planStrip.map((plan) => (
          <Box key={plan.src} width="100%" aspectRatio="1 / 1" overflow="hidden">
            <img
              src={`/landing/${plan.src}.webp`}
              srcSet={`/landing/${plan.src}@sm.webp 450w, /landing/${plan.src}.webp 900w`}
              sizes="(min-width: 48rem) 17vw, 33vw"
              alt={plan.alt}
              width={900}
              height={900}
              loading="lazy"
              decoding="async"
              className="landing-photo"
            />
          </Box>
        ))}
      </Flex>
    </Box>
  );
}
