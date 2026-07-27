import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@stackmyth/button";
import { EmptyState } from "@stackmyth/empty-state";
import { HelpCircleIcon } from "@stackmyth/icons";
import { Container, Stack } from "@stackmyth/layout";

import { copy } from "@/config/copy";

export const metadata: Metadata = {
  title: copy.event.notFoundTitle,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Container size="1">
      <Stack gap="6" py="8" px="4">
        <EmptyState
          icon={<HelpCircleIcon size={28} />}
          title={copy.event.notFoundTitle}
          description={copy.event.notFoundBody}
          action={
            <Button asChild size="md" variant="secondary">
              <Link href="/">{copy.common.back}</Link>
            </Button>
          }
        />
      </Stack>
    </Container>
  );
}
