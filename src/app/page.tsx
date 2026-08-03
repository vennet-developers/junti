import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Container, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { List, ListItem, ListItemContent, ListItemTitle } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import { BRAND_DESCRIPTION } from "@/config/brand";
import { ROUTES } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: { absolute: copy.home.title },
    description: BRAND_DESCRIPTION,
  };
}

export default async function HomePage() {
  /*
    A signed-in organizer has no use for the pitch: they came back to look at
    their events, so send them there. Signed-out visitors — the whole WhatsApp
    group following a link, or somebody arriving for the first time — get the
    landing page unchanged.

    This is why /` is in the proxy matcher now: the session cookie has to be
    refreshed before this check, or an organizer whose token had expired would
    silently be treated as a stranger and land on the pitch instead.
  */
  if (await getOrganizer()) redirect(ROUTES.myEvents);

  const { copy } = await getViewerCopy();

  return (
    <>
      {/* Always signed out: the redirect above sends account holders to their
          events, so this only ever renders the guest control. */}
      {/*
        The one screen where empty space is pure cost. It is the first thing
        anybody sees on a laptop — somebody sends the link and it gets opened
        where the mail was read — and a 448px column of phone-sized type in the
        middle of a monitor is not a first impression worth defending.
      */}
      <Container size="2" px="4" py="7">
        <Stack gap="6">
          {/*
            The tagline is the heading now, not the brand name. The header
            says "Junti" one line above, and a page that repeats it as its
            <h1> reads as a stutter — the wordmark identifies the product,
            the heading has to say what it does.
          */}
          <Stack gap="2">
            <Text variant="h1" fontFamily="var(--junti-display)">
              {copy.home.subheading}
            </Text>
          </Stack>

          <Text>{copy.home.pitch}</Text>

          {/*
            Two columns from `md`: what this is on the left, how it works on the
            right.

            The pitch and the steps answer two different questions, and stacked
            they make the reader scroll to find the second one. Side by side both
            are above the fold on a laptop, which is the only place this page has
            to earn a click.

            DOM order is the phone's order — CTAs, then the steps, then the
            disclaimer — so nothing moves on a 390px screen.
          */}
          <Grid columns={{ base: "1", md: "1fr 1fr" }} gap={{ base: "6", md: "7" }} align="start">
            <Stack gap="3">
              {/*
                Full-bleed on a phone, capped once there is a column to sit in:
                a primary button stretched the width of half a monitor stops
                looking like something you press.
              */}
              <Box width="100%" maxWidth={{ base: "100%", md: "20rem" }}>
                <Button asChild fullWidth size="lg">
                  <Link href={ROUTES.newEvent}>{copy.home.cta}</Link>
                </Button>
              </Box>
              {/* Secondary on purpose: both destinations now ask for the same
                  account, so the primary button is the one that says what this
                  is for. */}
              <Box width="100%" maxWidth={{ base: "100%", md: "20rem" }}>
                <Button asChild fullWidth size="md" variant="ghost">
                  <Link href={ROUTES.myEvents}>{copy.auth.myEventsLink}</Link>
                </Button>
              </Box>

              {/*
                The rule that used to sit between these two blocks, kept for the
                single-column case and dropped once they are side by side. In one
                column it separates the ask from the explanation; in two, the gap
                between the columns already does that and a horizontal rule under
                the buttons would be pointing at nothing.
              */}
              <Box display={{ base: "block", md: "none" }} pt="3">
                <Divider />
              </Box>
            </Stack>

            <Stack gap="3">
              <Text variant="h3" fontFamily="var(--junti-display)">
                {copy.home.howItWorksTitle}
              </Text>
              {/*
              No dividers. Four numbered steps already read as a sequence — the
              numerals do the separating, and a rule between each one only adds
              lines to a page whose whole idea is daylight on cream paper. It
              also stops this block from stacking four horizontal rules directly
              above the disclaimer card's own border.
            */}
              <List as="ol">
                {copy.home.steps.map((step: string, index: number) => (
                  <ListItem key={step}>
                    <ListItemContent>
                      <Flex gap="3" align="baseline">
                        <Text as="span" variant="small" color="muted" weight="semibold">
                          {index + 1}
                        </Text>
                        <ListItemTitle>{step}</ListItemTitle>
                      </Flex>
                    </ListItemContent>
                  </ListItem>
                ))}
              </List>

              {/* Travels with the steps rather than sitting under both columns:
                  it qualifies what the product does, which is what this column
                  is explaining. */}
              <Card surface="outlined">
                <CardContent>
                  <Text variant="small" color="muted">
                    {copy.home.disclaimer}
                  </Text>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Stack>
      </Container>
    </>
  );
}
