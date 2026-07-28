import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { List, ListItem, ListItemContent, ListItemTitle } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import { LanguageSwitcher } from "@/components/language-switcher";
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/config/brand";
import { ROUTES } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: { absolute: copy.home.title },
    description: BRAND_DESCRIPTION,
  };
}

export default async function HomePage() {
  const { copy } = await getViewerCopy();

  return (
    <Container size="1" px="4" py="7">
      <Stack gap="6">
        <Flex justify="end">
          <LanguageSwitcher />
        </Flex>

        <Stack gap="2">
          <Text variant="h1">{BRAND_NAME}</Text>
          <Text variant="lead" color="muted">
            {copy.home.subheading}
          </Text>
        </Stack>

        <Text>{copy.home.pitch}</Text>

        <Stack gap="3">
          <Button asChild fullWidth size="lg">
            <Link href={ROUTES.newEvent}>{copy.home.cta}</Link>
          </Button>
          {/* Secondary on purpose: creating an event must stay possible without
              an account. Signing in only adds the history and the photo. */}
          <Button asChild fullWidth size="md" variant="ghost">
            <Link href={ROUTES.myEvents}>{copy.auth.myEventsLink}</Link>
          </Button>
        </Stack>

        <Divider />

        <Stack gap="3">
          <Text variant="h3">{copy.home.howItWorksTitle}</Text>
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
  );
}
