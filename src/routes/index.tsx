import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Container, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { List, ListItem, ListItemContent, ListItemTitle } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { Link } from "@tanstack/react-router";
import { BRAND_DESCRIPTION } from "@/config/brand";
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
  return { title: copy.home.title };
});

export const Route = createFileRoute("/")({
  loader: () => gate(),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.title }, { name: "description", content: BRAND_DESCRIPTION }],
  }),
  component: HomePage,
});

function HomePage() {
  const { copy } = useCopy();

  return (
    /*
      Always signed out: the loader redirects account holders to their events,
      so this only ever renders for a visitor. The one screen where empty
      space is pure cost — it is the first thing anybody sees on a laptop.
    */
    <Container size="2" px="4" py="7">
      <Stack gap="6">
        {/* The tagline is the heading, not the brand name: the header says
            "Junti" one line above, and repeating it as <h1> reads as a
            stutter. */}
        <Stack gap="2">
          <Text variant="h1" fontFamily="var(--junti-display)">
            {copy.home.subheading}
          </Text>
        </Stack>

        <Text>{copy.home.pitch}</Text>

        {/*
          Two columns from `md`: what this is on the left, how it works on the
          right — both above the fold on a laptop, which is the only place
          this page has to earn a click. DOM order is the phone's order.
        */}
        <Grid columns={{ base: "1", md: "1fr 1fr" }} gap={{ base: "6", md: "7" }} align="start">
          <Stack gap="3">
            {/* Full-bleed on a phone, capped once there is a column to sit
                in: a primary button the width of half a monitor stops looking
                like something you press. */}
            <Box width="100%" maxWidth={{ base: "100%", md: "20rem" }}>
              <Button asChild fullWidth size="lg">
                <Link to={ROUTES.newEvent}>{copy.home.cta}</Link>
              </Button>
            </Box>
            {/* Secondary on purpose: both destinations ask for the same
                account, so the primary is the one that says what this is for. */}
            <Box width="100%" maxWidth={{ base: "100%", md: "20rem" }}>
              <Button asChild fullWidth size="md" variant="ghost">
                <Link to={ROUTES.myEvents}>{copy.auth.myEventsLink}</Link>
              </Button>
            </Box>

            {/* The rule between the blocks, kept for one column and dropped
                once they sit side by side — there the column gap already
                separates them. */}
            <Box display={{ base: "block", md: "none" }} pt="3">
              <Divider />
            </Box>
          </Stack>

          <Stack gap="3">
            <Text variant="h3" fontFamily="var(--junti-display)">
              {copy.home.howItWorksTitle}
            </Text>
            {/* No dividers: four numbered steps already read as a sequence,
                and rules here would stack directly above the disclaimer
                card's own border. */}
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

            {/* Travels with the steps: it qualifies what the product does,
                which is what this column explains. */}
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
  );
}
