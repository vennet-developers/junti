import { Center, Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Banner } from "@stackmyth/banner";
import { InfoIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { pageTitle } from "@/lib/page-title";
import { useCopy } from "@/components/copy-provider";

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
 * Acted on in the loader rather than behind a button, for the same reason.
 * Idempotent, so a second click on a link kept in an inbox changes nothing.
 */
const unsubscribe = createServerFn({ method: "GET" })
  .validator((data: { t?: string }) => data)
  .handler(async ({ data }) => {
    const [{ z }, { emailForUnsubscribeToken, suppressEmail }, { getViewerCopy }] =
      await Promise.all([import("zod"), import("@/lib/consent"), import("@/lib/locale")]);

    const { copy } = await getViewerCopy();

    /*
      A token, never the address.

      `?email=ana@correo.com` put somebody's address in their browser history, in
      every proxy log between them and here, and in the referrer of whatever they
      opened next — on the one page whose entire purpose is respecting their
      privacy. The token is the invitation's own id: opaque, unguessable, tied to
      one address, and it means a forwarded link unsubscribes the person it was
      sent to rather than whoever happened to click.
    */
    const token = z.uuid().safeParse(data.t ?? "");
    const email = token.success ? await emailForUnsubscribeToken(token.data) : null;

    if (email) await suppressEmail(email);

    return { title: copy.unsubscribe.title, email };
  });

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === "string" ? search.t : undefined,
  }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: ({ deps }) => unsubscribe({ data: { t: deps.t } }),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { copy } = useCopy();
  const { email } = Route.useLoaderData();

  const parsed = email ? { success: true as const, data: email } : { success: false as const };

  return (
    /*
      Narrow, and centred once the screen is tall enough to make that a
      question. A short card pinned to the top of a 900px viewport with
      everything under it empty reads as a page that stopped loading — and this
      is a gate somebody has been sent to, so looking broken is expensive.

      `minHeight` only from `md`: on a phone the content already fills what it
      needs and forcing a viewport fraction there would only add scroll.
    */
    <Center minHeight={{ base: "auto", md: "62dvh" }}>
      <Container size="1" px="4" py="7">
        <Stack gap="5">
          <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
            {copy.unsubscribe.heading}
          </Text>

          {parsed.success ? (
            <Banner variant="info" live="off" icon={<InfoIcon size={18} aria-hidden="true" />} title={copy.unsubscribe.doneTitle(parsed.data)}>
              {copy.unsubscribe.doneHelp}
            </Banner>
          ) : (
            <Banner variant="warning" live="off" icon={<TriangleAlertIcon size={18} aria-hidden="true" />} title={copy.unsubscribe.badLinkTitle}>
              {copy.unsubscribe.badLinkHelp}
            </Banner>
          )}
        </Stack>
      </Container>
    </Center>
  );
}
