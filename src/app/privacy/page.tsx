import type { Metadata } from "next";

import { Container, Divider, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ROUTES } from "@/config/routes";
import { getViewerCopy } from "@/lib/locale";
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
      {/*
        Capped by measure, not by container — and the old cap was wrong in the
        other direction.

        This is the longest continuous prose in the product and the one page
        where somebody is genuinely reading rather than tapping. 448px of this
        body type is roughly 45 characters a line, which is tighter than
        comfortable for sustained reading; the typographic range is 60–75, and
        68ch sits in the middle of it at any font size because the unit scales
        with the type rather than fighting it.

        **The container has to be wider than the cap or the cap does nothing.**
        This first shipped as `size="2"` plus `maxWidth="68ch"`, which reads as
        two safeguards and is really one: `size="2"` leaves 656px of inner width
        and 68ch resolves to 679px, so the container bound first and the measure
        was whatever 656px happened to be rather than anything chosen. Measuring
        caught it — the cap was inert. `size="3"` leaves 848px, which is room for
        the ch value to be the thing that decides.

        A privacy notice that is hard to read is its own kind of compliance
        problem, which is why this got measured instead of eyeballed.
      */}
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
