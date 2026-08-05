import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { pageTitle } from "@/lib/page-title";
import { signInPath } from "@/config/routes";

import { WelcomeSteps } from "./-welcome-steps";

/**
 * What Junti does, for somebody who has only ever been a guest.
 *
 * **Opt-in, and that is the whole design.** It is not shown after sign-up and
 * it does not interrupt anything: the agenda offers it once while it is empty,
 * and the account menu keeps it reachable forever. The card asks that skipping
 * be "neither penalized nor re-prompted", and the way to honour that is to
 * never have prompted in a way that could be refused.
 *
 * Three screens, and each one is a sentence somebody could repeat afterwards.
 * The audience is a person who joined a friend's match with a link and has no
 * idea they could run one — so the only job here is "you can be on the other
 * side of this", not a feature list.
 *
 * Product tours over live UI and gamified checklists are out of scope on the
 * card, and both would be worse: this is read once, in under a minute, by
 * somebody who might not come back.
 */
const gate = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getOrganizer }, { getViewerCopy }] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/locale"),
  ]);

  const organizer = await getOrganizer();
  if (!organizer) throw redirect({ to: signInPath("/welcome") as never });

  const { copy } = await getViewerCopy();
  return { title: copy.welcome.title };
});

export const Route = createFileRoute("/welcome")({
  loader: () => gate(),
  head: ({ loaderData }) => ({
    meta: [
      { title: pageTitle(loaderData?.title) },
      // Behind an account, so there is nothing here for a crawler.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { copy } = useCopy();

  return (
    <Container size="2" px="4" py="7">
      <Stack gap="6">
        <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
          {copy.welcome.title}
        </Text>

        <WelcomeSteps />
      </Stack>
    </Container>
  );
}
