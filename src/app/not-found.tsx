import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@stackmyth/button";
import { EmptyState } from "@stackmyth/empty-state";
import { HelpCircleIcon } from "@stackmyth/icons";
import { Center, Container } from "@stackmyth/layout";

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
    /*
      Narrow and vertically centred. A 404 is one short card, and one short card
      pinned to the top of a 900px screen with everything below it empty reads as
      a page that failed to finish loading — which is the wrong impression for
      the page whose whole job is to explain that something is missing.

      `minHeight` only from `md` up: on a phone the card already fills what it
      needs to and forcing a viewport fraction there would just add scroll.
    */
    <Center minHeight={{ base: "auto", md: "58dvh" }}>
      <Container size="1" px="4" py="8">
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
      </Container>
    </Center>
  );
}
