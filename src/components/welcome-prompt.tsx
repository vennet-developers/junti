"use client";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Link } from "@tanstack/react-router";

import { useCopy } from "@/components/copy-provider";

/**
 * The offer on an empty agenda.
 *
 * Rendered only while the account has never finished or dismissed the welcome,
 * so it appears once and then stops — which is the "not re-prompted" half of
 * the criterion. Deliberately not a modal: an interruption is the one shape
 * this content must not take.
 */
export function WelcomePrompt() {
  const { copy } = useCopy();

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <Stack gap="1">
            <Text weight="semibold">{copy.welcome.promptTitle}</Text>
            <Text variant="small" color="muted">
              {copy.welcome.promptBody}
            </Text>
          </Stack>
          <Flex>
            <Button asChild size="sm" variant="secondary">
              <Link to="/welcome">{copy.welcome.promptCta}</Link>
            </Button>
          </Flex>
        </Stack>
      </CardContent>
    </Card>
  );
}
