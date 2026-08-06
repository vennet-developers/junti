import { Container, Divider, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { pageTitle } from "@/lib/page-title";
import { ROUTES } from "@/config/routes";

/**
 * The privacy notice — the one page in this app that is meant to be found.
 * Everything else is `noindex` because a URL is the access control; a notice
 * somebody has to already be inside the product to read is not serving the
 * purpose it exists for.
 *
 * `POLICY_VERSION` arrives through the loader rather than by importing
 * `@/lib/consent` here: that module is server-only (it writes consent rows),
 * and this component ships to the browser. The version is the same string
 * written into every consent row — what lets an old grant point at the text
 * that was actually on screen.
 */
const getMeta = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getViewerCopy }, { POLICY_VERSION }] = await Promise.all([
    import("@/lib/locale"),
    import("@/lib/consent"),
  ]);

  const { copy } = await getViewerCopy();
  return { title: copy.privacy.title, policyVersion: POLICY_VERSION };
});

export const Route = createFileRoute("/privacy")({
  loader: () => getMeta(),
  head: ({ loaderData }) => ({
    // Deliberately indexable — no robots meta here, unlike everything else.
    meta: [{ title: pageTitle(loaderData?.title) }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { copy } = useCopy();
  const { policyVersion } = Route.useLoaderData();

  const sections = [
    { heading: copy.privacy.responsibleTitle, body: copy.privacy.responsibleBody },
    { heading: copy.privacy.dataTitle, body: copy.privacy.dataBody },
    { heading: copy.privacy.purposesTitle, body: copy.privacy.purposesBody },
    { heading: copy.privacy.googleTitle, body: copy.privacy.googleBody },
    { heading: copy.privacy.sharingTitle, body: copy.privacy.sharingBody },
    { heading: copy.privacy.processorsTitle, body: copy.privacy.processorsBody },
    { heading: copy.privacy.transferTitle, body: copy.privacy.transferBody },
    { heading: copy.privacy.rightsTitle, body: copy.privacy.rightsBody },
    { heading: copy.privacy.retentionTitle, body: copy.privacy.retentionBody },
  ];

  return (
    /*
      Capped by measure, not by container: 68ch inside a `size="3"` frame
      (848px), so the ch value is the thing that decides. The history of that
      pairing — including the shipped version where the cap was inert — is in
      the Next page's git history; the measurement carried over as-is.
    */
    <Container size="3" px="4" py="6">
      <Stack gap="6" maxWidth="68ch">
        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[{ label: copy.nav.home, href: ROUTES.home }, { label: copy.privacy.title }]}
        />

        <Stack gap="2">
          <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
            {copy.privacy.heading}
          </Text>
          <Text color="muted">{copy.privacy.intro}</Text>
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

        {/* The version, spelled out, comparable against a consent row. */}
        <Text variant="small" color="muted">
          {copy.privacy.version(policyVersion)}
        </Text>
      </Stack>
    </Container>
  );
}
