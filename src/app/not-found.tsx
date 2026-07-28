import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@stackmyth/button";
import { EmptyState } from "@stackmyth/empty-state";
import { HelpCircleIcon } from "@stackmyth/icons";
import { Container, Stack } from "@stackmyth/layout";

import { getViewerCopy } from "@/lib/locale";
import { ROUTES } from "@/config/routes";

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.event.notFoundTitle,
    robots: { index: false, follow: false },
  };
}

export default async function NotFound() {
  const { copy } = await getViewerCopy();

  return (
    <Container size="1" px="4" py="8">
      <Stack gap="6">
        <EmptyState
          icon={<HelpCircleIcon size={28} />}
          title={copy.event.notFoundTitle}
          description={copy.event.notFoundBody}
          action={
            <Button asChild size="md" variant="secondary">
              <Link href={ROUTES.home}>{copy.common.back}</Link>
            </Button>
          }
        />
      </Stack>
    </Container>
  );
}
