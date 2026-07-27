"use client";

import { useEffect } from "react";

import { Button } from "@stackmyth/button";
import { EmptyState } from "@stackmyth/empty-state";
import { TriangleAlertIcon } from "@stackmyth/icons";
import { Box, Container, Flex, Stack } from "@stackmyth/layout";

import { copy } from "@/config/copy";

/**
 * Route error boundary.
 *
 * The most likely cause in production is a paused Supabase project (see
 * README → "Keeping it alive"), which surfaces as a connection failure at
 * render time. `reset()` re-renders the segment, which is genuinely worth a tap
 * once the database wakes up.
 *
 * Composed from Stackmyth primitives only. There is no error-tracking service —
 * the zero-cost constraint rules one out — so the detail goes to the console,
 * which is where a developer would look anyway.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <Container size="1">
      <Stack gap="6" py="8" px="4">
        <EmptyState
          icon={<TriangleAlertIcon size={28} />}
          title={copy.errorBoundary.title}
          description={copy.errorBoundary.body}
          action={
            <Flex gap="2" wrap="wrap" justify="center">
              <Button type="button" size="md" onClick={reset}>
                {copy.errorBoundary.retry}
              </Button>
              <Button asChild size="md" variant="secondary">
                {/* Box(as="a") keeps the cloned child a Stackmyth primitive.
                    A full page load, not a client transition — if the router
                    itself is unhappy, next/link would fail the same way. */}
                <Box as="a" href="/">
                  {copy.errorBoundary.home}
                </Box>
              </Button>
            </Flex>
          }
        />
      </Stack>
    </Container>
  );
}
