import type { Metadata } from "next";
import { z } from "zod";

import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AppHeader } from "@/components/app-header";
import { Notice } from "@/components/notice";
import { emailForUnsubscribeToken, suppressEmail } from "@/lib/consent";
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
 * **A forwarded link no longer unsubscribes the wrong person.** It used to: the
 * address was in the URL, so whoever clicked removed whoever was named. The
 * token is the invitation's id, which resolves to the address the invitation
 * was sent to and to nothing else — forwarding it now unsubscribes the person it
 * was always about, which is the only outcome that was ever intended.
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
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const { copy } = await getViewerCopy();
  const { theme } = await resolvePreferences();

  /*
    A token, never the address.

    `?email=ana@correo.com` put somebody's address in their browser history, in
    every proxy log between them and here, and in the referrer of whatever they
    opened next — on the one page whose entire purpose is respecting their
    privacy. The token is the invitation's own id: opaque, unguessable, tied to
    one address, and it means a forwarded link unsubscribes the person it was
    sent to rather than whoever happened to click.
  */
  const token = z.uuid().safeParse(t ?? "");
  const email = token.success ? await emailForUnsubscribeToken(token.data) : null;

  if (email) await suppressEmail(email);

  const parsed = email ? { success: true as const, data: email } : { success: false as const };

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
