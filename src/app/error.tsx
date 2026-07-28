"use client";

import { useEffect } from "react";

import Link from "next/link";

import { Button } from "@stackmyth/button";
import { EmptyState } from "@stackmyth/empty-state";
import { TriangleAlertIcon } from "@stackmyth/icons";
import { Container, Flex, Stack } from "@stackmyth/layout";

import { useCopy } from "@/components/copy-provider";
import { ROUTES } from "@/config/routes";

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
  // Safe here: error.tsx renders INSIDE the root layout, which is where the
  // provider lives. Only a failure of the layout itself would escape it, and
  // that needs a global-error.tsx this project does not have.
  const { copy } = useCopy();

  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <Container size="1" px="4" py="8">
      <Stack gap="6">
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
                {/* next/link because this is an internal route — a bare <a>
                    to a page is an ESLint error in Next. A full page load, not
                    a client transition: if the router itself is unhappy,
                    next/link would fail the same way. */}
                <Link href={ROUTES.home}>{copy.errorBoundary.home}</Link>
              </Button>
            </Flex>
          }
        />
      </Stack>
    </Container>
  );
}
