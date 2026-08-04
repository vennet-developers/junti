import { createFileRoute } from "@tanstack/react-router";

import type { AuthLinkAction } from "@/lib/email/templates/auth-link";

/**
 * Supabase's Send Email Hook — the port of `src/app/api/auth/send-email/route.ts`,
 * logic untouched.
 *
 * Supabase stops sending authentication mail itself and calls this instead,
 * handing over the token and letting the app decide what the message looks like.
 * That is the whole point: the sign-in email was the last one going out from
 * `noreply@mail.app.supabase.io`, in English, with none of the frame every other
 * message here carries.
 *
 * **What stays with Supabase, deliberately.** Issuing and expiring tokens,
 * deciding whether an address is a new signup or a returning magic link, rate
 * limiting the public endpoint that triggers all this, and creating the user.
 * The alternative — generating links ourselves with the service_role key — put
 * every one of those in this codebase, along with an admin credential and an
 * abuse surface. This route only renders and sends.
 *
 * Runs on Node either way now — TanStack Start has no edge runtime to opt out
 * of — which is what the signature check (`node:crypto`) and the React renderer
 * need. Not matched by `src/proxy.ts`, which skips `/api` — there is no session
 * here to refresh and nothing to gain from a round trip to Supabase.
 */

/** Supabase's own default. Shown in the message so a stale link is explicable. */
const TOKEN_MINUTES = "60";

/** Standard Webhooks says every response carries JSON, errors included. */
function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

interface HookPayload {
  user?: { email?: string; user_metadata?: Record<string, unknown> };
  email_data?: {
    token_hash?: string;
    email_action_type?: string;
    redirect_to?: string;
    /**
     * Part of the payload and deliberately UNUSED. Supabase sends its own
     * project domain here, not this app's — building a link from it puts
     * `https://<ref>.supabase.co/auth/callback` in somebody's inbox.
     */
    site_url?: string;
  };
}

/**
 * Where the link should land, and whether we are willing to send people there.
 *
 * **The app's own origin comes from the request, not from the payload.** The
 * hook's `site_url` field is Supabase's notion of the site and in practice
 * arrives as the Supabase project's own domain — using it as a fallback put
 * `https://<ref>.supabase.co/auth/callback` inside a real email, a link that
 * goes nowhere. The request landed on this app, so its host is the one thing
 * here that cannot be wrong about what this app is.
 *
 * `redirect_to` is echoed back from the request that started the sign-in, and
 * Supabase has already checked it against the project's allow-list. It is
 * checked again anyway, because the value ends up inside an email as something
 * a person will click, and "someone else validated it" is not a property this
 * code can see. Anything unrecognised falls back to this app's own origin.
 *
 * localhost is allowed on purpose: Supabase cannot call a laptop, so a sign-in
 * started locally has its email rendered by the deployed app — and the link
 * still has to come back to the machine that asked for it.
 *
 * The `next` inside is carried through untouched. The callback validates it as
 * a relative path, which is where that check belongs.
 */
function callbackUrl(
  tokenHash: string,
  type: string,
  redirectTo: string,
  appOrigin: string,
): string {
  let target: URL | null = null;
  try {
    target = new URL(redirectTo);
  } catch {
    target = null;
  }

  const allowed =
    target !== null &&
    (target.origin === appOrigin ||
      target.hostname === "localhost" ||
      target.hostname === "127.0.0.1");

  const url = new URL("/auth/callback", allowed && target ? target.origin : appOrigin);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);

  const next = target?.searchParams.get("next");
  if (next) url.searchParams.set("next", next);

  return url.toString();
}

export const Route = createFileRoute("/api/auth/send-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /*
          Server modules arrive by dynamic import because this FILE ships to
          the browser: a route is part of the client route tree even when all
          it defines is server handlers, and a top-level import here would drag
          the email provider — and behind it `node:crypto` and the copy
          dictionaries — into the client bundle.
        */
        const [{ DEFAULT_LOCALE, isLocale }, { sendMessage }, { origin }, { verifyWebhook }] =
          await Promise.all([
            import("@/config/copy"),
            import("@/lib/email/provider"),
            import("@/lib/urls"),
            import("@/lib/webhook-signature"),
          ]);

        const secret = process.env.SEND_EMAIL_HOOK_SECRET?.trim() ?? "";

        /*
          Refused rather than waved through when unconfigured. A missing secret here
          would otherwise turn a public endpoint into something that emails arbitrary
          addresses on request, which is a worse failure than sign-in not working.
        */
        if (!secret) {
          return json({ error: { message: "hook not configured" } }, { status: 500 });
        }

        // The RAW text. Parsing first and re-serialising changes bytes the signature
        // was computed over, and nothing would ever verify.
        const body = await request.text();

        const valid = verifyWebhook(
          body,
          {
            id: request.headers.get("webhook-id"),
            timestamp: request.headers.get("webhook-timestamp"),
            signature: request.headers.get("webhook-signature"),
          },
          secret,
        );

        if (!valid) {
          return json({ error: { message: "invalid signature" } }, { status: 401 });
        }

        let payload: HookPayload;
        try {
          payload = JSON.parse(body) as HookPayload;
        } catch {
          return json({ error: { message: "malformed payload" } }, { status: 400 });
        }

        const email = payload.user?.email;
        const data = payload.email_data;

        if (!email || !data?.token_hash || !data.email_action_type) {
          return json({ error: { message: "missing user or email_data" } }, { status: 400 });
        }

        /*
          A `token_hash` link, NOT the PKCE `code` flow.

          PKCE keeps a verifier in a cookie belonging to the browser that started the
          sign-in, so a link opened anywhere else fails with `bad_code_verifier` — the
          exact failure that sent somebody back to the sign-in form after clicking a
          perfectly good link. `verifyOtp` needs no verifier, so this works from the
          phone even though the link was asked for on a laptop.

          The trade is real and deliberate: the link is no longer bound to one browser,
          so whoever holds it can use it. That is how magic links have always worked,
          and it is what Supabase's own confirmation mail already did.
        */
        const appOrigin = await origin();
        const url = callbackUrl(
          data.token_hash,
          data.email_action_type,
          data.redirect_to ?? "",
          appOrigin,
        );

        /*
          The reader's language, chosen at sign-in and stored on the account — see the
          `data` passed to `signInWithOtp`. This is the thing Supabase's own templates
          could never do: they are one language for everybody.
        */
        const stored = payload.user?.user_metadata?.locale;
        const locale = typeof stored === "string" && isLocale(stored) ? stored : DEFAULT_LOCALE;

        /*
          The one place where the environment is the wrong answer.

          Everywhere else, "is this a test" means "is this process production", and
          `sendMessage` fills that in. Not here: Supabase cannot call a laptop, so
          this hook ALWAYS runs on the production deployment — including for a
          sign-in somebody started on localhost, which is precisely the mail most
          worth marking, because it is the one being sent all day while testing.

          The link is the honest signal. It was built from `redirect_to`, so it
          points back at whichever origin asked for it.
        */
        const sandbox = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

        const result = await sendMessage({
          to: email,
          template: "auth-link",
          locale,
          sandbox,
          values: {
            url,
            action: data.email_action_type as AuthLinkAction,
            expiresInMinutes: TOKEN_MINUTES,
          },
        });

        /*
          A provider failure is reported as retry-able, which is what gets Supabase to
          try again rather than telling the person their sign-in failed. `retry-after`
          has to be present and non-empty for that to happen; the whole invocation is
          still capped at five seconds, retries included.
        */
        if (result.status === "failed") {
          return json(
            { error: { message: `send failed: ${result.reason}` } },
            { status: 503, headers: { "retry-after": "true" } },
          );
        }

        // A suppressed address is not an error: they have already told the provider to
        // stop. Retrying would burn the budget to reach somebody unreachable.
        return json({});
      },
    },
  },
});
