import { Center, Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { Notice } from "@/components/notice";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { SignInForm } from "@/components/sign-in-form";
import { pageTitle } from "@/lib/page-title";
import { ROUTES } from "@/config/routes";

/** Only relative paths, so `?next=https://evil.example` cannot turn the
    sign-in flow into an open redirect. */
function safeDestination(next: string | undefined): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.myEvents;
}

const gate = createServerFn({ method: "GET" })
  .validator((data: { next?: string }) => data)
  .handler(async ({ data }) => {
    const [{ getCurrentUser }, { getViewerCopy }] = await Promise.all([
      import("@/lib/supabase/server"),
      import("@/lib/locale"),
    ]);

    if (await getCurrentUser()) {
      throw redirect({ to: safeDestination(data.next) as never });
    }

    const { copy } = await getViewerCopy();
    return { title: copy.auth.signInTitle };
  });

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { next?: string; error?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  loaderDeps: ({ search }) => ({ next: search.next }),
  loader: ({ deps }) => gate({ data: { next: deps.next } }),
  head: ({ loaderData }) => ({
    meta: [{ title: pageTitle(loaderData?.title) }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { copy } = useCopy();
  const { next, error } = Route.useSearch();
  const redirectTo = safeDestination(next);

  return (
    /*
      Signed out by definition — the loader catches anyone who is not.
      Narrow, and centred once the screen is tall enough to make that a
      question: a short card pinned to the top of a 900px viewport reads as a
      page that stopped loading, and this is a gate somebody was SENT to.
    */
    <Center minHeight={{ base: "auto", md: "62dvh" }}>
      <Container size="1" px="4" py="7">
        <Stack gap="6">
          <PageBreadcrumb
            label={copy.nav.breadcrumbLabel}
            items={[{ label: copy.nav.home, href: ROUTES.home }, { label: copy.auth.signInTitle }]}
          />

          <Stack gap="2">
            <Text as="h1" variant="h2" fontFamily="var(--junti-display)">
              {copy.auth.signInHeading}
            </Text>
            <Text color="muted">{copy.auth.signInSubheading}</Text>
          </Stack>

          {/* Why they are back here, when they are back here. Naming the
              cause is what turns a dead end into an instruction. */}
          {error === "browser" ? (
            <Notice tone="warning" title={copy.auth.linkWrongBrowser}>
              {copy.auth.linkWrongBrowserHelp}
            </Notice>
          ) : error ? (
            <Notice tone="warning" title={copy.auth.linkFailed}>
              {copy.auth.linkFailedHelp}
            </Notice>
          ) : null}

          <SignInForm redirectTo={redirectTo} />
        </Stack>
      </Container>
    </Center>
  );
}
