import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ROUTES, signInPath } from "@/config/routes";
import { formatEventDateTimeShort } from "@/lib/format";
import { pickLabel } from "@/lib/labels";
import { getViewerCopy } from "@/lib/locale";
import { getOrganizer } from "@/lib/organizer";
import { resolvePreferences } from "@/lib/preferences";
import { loadPendingApprovals } from "@/lib/roster";
import { managePath } from "@/lib/urls";

import { ApprovalQueue, type ApprovalRow } from "./approval-queue";

/**
 * One place to clear every receipt waiting on this organizer.
 *
 * The decision already existed, one event at a time, inside each organizer
 * panel. What it cost was the walking: an organizer with a season of weekly
 * matches opened a dozen panels to wave through a dozen identical transfers.
 * This is the same decision with the walking removed — and it is the only
 * screen in the app that reads across events, which is why it lives at the top
 * level rather than under one of them.
 *
 * Signed-in only, and scoped by ownership rather than by token: the whole point
 * is the events that are yours, which a token cannot express.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return {
    title: copy.approvals.title,
    robots: { index: false, follow: false },
  };
}

export default async function ApprovalsPage() {
  const organizer = await getOrganizer();
  if (!organizer) redirect(signInPath(ROUTES.approvals));

  const { copy, locale, timeZone } = await resolvePreferences();

  const pending = await loadPendingApprovals(organizer.id);

  /*
    The policy's wording comes from the catalogue's jsonb labels, resolved
    here — the same `pickLabel` fallback chain the event pages use, so a
    policy whose translation is missing reads as its slug rather than as
    nothing.
  */
  const rows: ApprovalRow[] = pending.map((item) => ({
    submissionId: item.submissionId,
    eventTitle: item.eventTitle,
    participantName: item.participantName,
    policyLabel: pickLabel(item.policyLabels, locale, item.policySlug),
    note: item.note,
    /*
      Formatted on the server for the same reason every other date in this app
      is: `Intl` and the timezone table stay out of the browser bundle. The
      organizer's own zone rather than each event's — this list is read as a
      single queue, and "yesterday" has to mean the same thing down the column.
      UTC only when nothing is known yet, which is the same floor the event
      pages use before the browser reports a zone.
    */
    waitingSince: formatEventDateTimeShort(item.submittedAt, timeZone ?? "UTC", copy.intlLocale),
    hasEvidence: item.hasEvidence,
    managePath: managePath(item.publicToken, item.organizerToken),
    evidencePath: `${managePath(item.publicToken, item.organizerToken)}/evidence/${item.submissionId}`,
  }));

  return (
    <>
      <Container size="3" px="4" py="6">
        <Stack gap="6">
          <PageBreadcrumb
            label={copy.nav.breadcrumbLabel}
            items={[
              { label: copy.auth.myEventsLink, href: ROUTES.myEvents },
              { label: copy.approvals.link },
            ]}
          />

          <Stack gap="2">
            <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
              {copy.approvals.heading}
            </Text>
            <Text color="muted">{copy.approvals.subheading}</Text>
          </Stack>

          <ApprovalQueue rows={rows} />
        </Stack>
      </Container>
    </>
  );
}
