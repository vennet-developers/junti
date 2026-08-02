import type { Metadata } from "next";

import { Container, Divider, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ROUTES } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { resolvePreferences } from "@/lib/preferences";
import { POLICY_VERSION } from "@/lib/consent";

/**
 * The privacy notice.
 *
 * **The one page in this app that is meant to be found.** Everything else is
 * `noindex` because a URL is the access control; this is the opposite — a notice
 * somebody has to already be inside the product to read is not serving the
 * purpose it exists for.
 *
 * Written as prose in the reader's language rather than pulled from a template,
 * because the parts that matter here are specific: which sub-processors, in
 * which countries, for which purpose. A generic notice is worse than none — it
 * claims a compliance that was never done.
 *
 * `POLICY_VERSION` is stamped at the bottom and is the same string written into
 * every consent row. That is what lets an old grant still mean something: it
 * points at the text that was on screen, not at whatever this page says today.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.privacy.title,
    // Deliberately indexable. See the note above.
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage() {
  const { copy } = await getViewerCopy();
  const { theme } = await resolvePreferences();
  const organizer = await getOrganizer();

  const sections = [
    { heading: copy.privacy.responsibleTitle, body: copy.privacy.responsibleBody },
    { heading: copy.privacy.dataTitle, body: copy.privacy.dataBody },
    { heading: copy.privacy.purposesTitle, body: copy.privacy.purposesBody },
    { heading: copy.privacy.sharingTitle, body: copy.privacy.sharingBody },
    { heading: copy.privacy.processorsTitle, body: copy.privacy.processorsBody },
    { heading: copy.privacy.transferTitle, body: copy.privacy.transferBody },
    { heading: copy.privacy.rightsTitle, body: copy.privacy.rightsBody },
    { heading: copy.privacy.retentionTitle, body: copy.privacy.retentionBody },
  ];

  return (
    <>
      <AppHeader organizer={organizer} theme={theme} />

      <Container size="1" px="4" py="6">
        <Stack gap="6">
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

          {/* The version, spelled out. Somebody who wants to know what they
              agreed to needs to be able to compare it with what their consent
              row says. */}
          <Text variant="small" color="muted">
            {copy.privacy.version(POLICY_VERSION)}
          </Text>
        </Stack>
      </Container>
    </>
  );
}
