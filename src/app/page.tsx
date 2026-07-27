import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { List, ListItem, ListItemContent, ListItemTitle } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@/config/brand";
import { copy } from "@/config/copy";

export const metadata: Metadata = {
  title: { absolute: copy.home.title },
  description: BRAND_DESCRIPTION,
};

export default function HomePage() {
  return (
    <Container size="1">
      <Stack gap="6" py="7" px="4">
        <Stack gap="2">
          <Text variant="h1">{BRAND_NAME}</Text>
          <Text variant="lead" color="muted">
            {copy.home.subheading}
          </Text>
        </Stack>

        <Text>{copy.home.pitch}</Text>

        <Button asChild fullWidth size="lg">
          <Link href="/new">{copy.home.cta}</Link>
        </Button>

        <Divider />

        <Stack gap="3">
          <Text variant="h3">{copy.home.howItWorksTitle}</Text>
          <List as="ol" divided>
            {copy.home.steps.map((step, index) => (
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
