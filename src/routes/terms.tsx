import { Container, Divider, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { Link } from "@/components/link";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { TERMS_VERSION } from "@/config/terms";
import { pageTitle } from "@/lib/page-title";
import { ROUTES } from "@/config/routes";

/**
 * The terms of service — the third public page, and the second one meant to be
 * found.
 *
 * Built as a mirror of `/privacy` on purpose: same container, same measure,
 * same section shape, same version line at the bottom. Two legal pages that
 * look like two different products is how somebody starts wondering which one
 * is the real one.
 *
 * **Written because Google's OAuth consent screen requires a public terms URL**,
 * which is a poor reason to write terms and a perfectly good reason to stop
 * putting it off. The promises in here were already true — the product has
 * refused to touch anybody's money since the day that decision was made, and
 * says so in its landing copy, its privacy notice and its schema comments.
 * What was missing was one page that said it plainly, in one place, with a
 * date on it.
 *
 * `TERMS_VERSION` is a plain config constant rather than something loaded from
 * the server, unlike `POLICY_VERSION` next door. The privacy version is
 * written into consent rows and therefore lives beside the code that writes
 * them; nobody ticks a box for these, so there is nothing to join it against
 * and no reason to make the page wait on a round trip.
 */
const getMeta = createServerFn({ method: "GET" }).handler(async () => {
  const { getViewerCopy } = await import("@/lib/locale");
  const { copy } = await getViewerCopy();

  return { title: copy.terms.title };
});

export const Route = createFileRoute("/terms")({
  loader: () => getMeta(),
  head: ({ loaderData }) => ({
    // Indexable, like the privacy notice and unlike everything else in the
    // app. Terms nobody can reach are not terms.
    meta: [{ title: pageTitle(loaderData?.title) }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { copy } = useCopy();

  /*
    Order is an argument, not a list. "What Junti is" comes first because
    nothing else parses without it, and the money section comes SECOND —
    before accounts, before conduct, before liability — because it is the
    single thing a person needs to understand about this product and the one
    misunderstanding that would matter.
  */
  const sections = [
    { heading: copy.terms.whatTitle, body: copy.terms.whatBody },
    { heading: copy.terms.moneyTitle, body: copy.terms.moneyBody },
    { heading: copy.terms.betweenTitle, body: copy.terms.betweenBody },
    { heading: copy.terms.accountTitle, body: copy.terms.accountBody },
    { heading: copy.terms.organizerTitle, body: copy.terms.organizerBody },
    { heading: copy.terms.contentTitle, body: copy.terms.contentBody },
    { heading: copy.terms.prohibitedTitle, body: copy.terms.prohibitedBody },
    { heading: copy.terms.availabilityTitle, body: copy.terms.availabilityBody },
    { heading: copy.terms.liabilityTitle, body: copy.terms.liabilityBody },
    { heading: copy.terms.endingTitle, body: copy.terms.endingBody },
    { heading: copy.terms.changesTitle, body: copy.terms.changesBody },
    { heading: copy.terms.lawTitle, body: copy.terms.lawBody },
  ];

  return (
    // 68ch inside a `size="3"` frame, so the measure decides rather than the
    // container. Same pairing as `/privacy` — see its note for the history.
    <Container size="3" px="4" py="6">
      <Stack gap="6" maxWidth="68ch">
        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[{ label: copy.nav.home, href: ROUTES.home }, { label: copy.terms.title }]}
        />

        <Stack gap="2">
          <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
            {copy.terms.heading}
          </Text>
          <Text color="muted">{copy.terms.intro}</Text>
        </Stack>

        {sections.map((section) => (
          <Stack key={section.heading} gap="2">
            <Text as="h2" variant="h3" fontFamily="var(--junti-display)">
              {section.heading}
            </Text>
            <Text>{section.body}</Text>
          </Stack>
        ))}

        <Divider />

        {/* The two documents point at each other. Somebody who lands here from
            a consent screen is one click from the half that covers their data,
            which is the half most people actually came to read. */}
        <Text variant="small">
          <Link href={ROUTES.privacy}>{copy.terms.privacyLink}</Link>
        </Text>

        <Text variant="small" color="muted">
          {copy.terms.version(TERMS_VERSION)}
        </Text>
      </Stack>
    </Container>
  );
}
