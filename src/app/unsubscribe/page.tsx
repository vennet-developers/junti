import type { Metadata } from "next";
import { z } from "zod";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { Notice } from "@/components/notice";
import { suppressEmail } from "@/lib/consent";
import { getViewerCopy } from "@/lib/locale";
import { resolvePreferences } from "@/lib/preferences";

/**
 * Where an unsubscribe link lands.
 *
 * **No account, no sign-in, no confirmation step.** The people who need this
 * most are the ones an organizer typed into an invite box: they never agreed to
 * anything, have no account to revoke with, and asking them to make one in
 * order to be left alone would be the opposite of honouring the request. One
 * click has to be enough.
 *
 * That does mean a link somebody forwards could unsubscribe an address that did
 * not ask. The trade is deliberate and it goes this way round: the cost is one
 * person missing invitations they can still receive by any other route, against
 * a legal obligation and somebody being written to after saying stop. A
 * confirmation button would look careful and would mostly convert a request
 * into a dead end.
 *
 * Acted on during render rather than behind a button, for the same reason.
 * Idempotent, so a second click on a link kept in an inbox changes nothing.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { copy } = await getViewerCopy();

  return { title: copy.unsubscribe.title, robots: { index: false, follow: false } };
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const { copy } = await getViewerCopy();
  const { theme } = await resolvePreferences();

  // Loose on purpose, like every other address check here: the point is to
  // reject obvious junk in a URL, not to adjudicate what an address may be.
  const parsed = z
    .string()
    .trim()
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)
    .safeParse(email ?? "");

  if (parsed.success) await suppressEmail(parsed.data);

  return (
    <>
      <AppHeader organizer={null} theme={theme} />

      <Container size="1" px="4" py="7">
        <Stack gap="5">
          <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
            {copy.unsubscribe.heading}
          </Text>

          {parsed.success ? (
            <Notice tone="info" title={copy.unsubscribe.doneTitle(parsed.data)}>
              {copy.unsubscribe.doneHelp}
            </Notice>
          ) : (
            <Notice tone="warning" title={copy.unsubscribe.badLinkTitle}>
              {copy.unsubscribe.badLinkHelp}
            </Notice>
          )}
        </Stack>
      </Container>
    </>
  );
}
