import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { List, ListItem, ListItemContent, ListItemTitle } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { BRAND_DESCRIPTION } from "@/config/brand";
import { ROUTES } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { resolvePreferences } from "@/lib/preferences";

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
    their events, so send them there. Anonymous visitors — the whole WhatsApp
    group following a link, or somebody arriving for the first time — get the
    landing page unchanged.

    This is why /` is in the proxy matcher now: the session cookie has to be
    refreshed before this check, or an organizer whose token had expired would
    silently be treated as a stranger and land on the pitch instead.
  */
  if (await getOrganizer()) redirect(ROUTES.myEvents);

  const { copy } = await getViewerCopy();
  const { theme } = await resolvePreferences();

  return (
    <>
      {/* Always signed out: the redirect above sends account holders to their
          events, so this only ever renders the guest control. */}
      <AppHeader organizer={null} theme={theme} signInNext={ROUTES.myEvents} />

      <Container size="1" px="4" py="7">
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

          <Stack gap="3">
            <Button asChild fullWidth size="lg">
              <Link href={ROUTES.newEvent}>{copy.home.cta}</Link>
            </Button>
            {/* Secondary on purpose: creating an event must stay possible
                without an account. Signing in only adds the history and the
                photo. */}
            <Button asChild fullWidth size="md" variant="ghost">
              <Link href={ROUTES.myEvents}>{copy.auth.myEventsLink}</Link>
            </Button>
          </Stack>

          <Divider />

          <Stack gap="3">
            <Text variant="h3" fontFamily="var(--junti-display)">
              {copy.home.howItWorksTitle}
            </Text>
            <List as="ol" divided>
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
          </Stack>

          <Card surface="outlined">
            <CardContent>
              <Text variant="small" color="muted">
                {copy.home.disclaimer}
              </Text>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
