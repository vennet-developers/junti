import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, isLocale } from "@/config/copy";
import { sendMessage } from "@/lib/email/provider";
import type { AuthLinkAction } from "@/lib/email/templates/auth-link";
import { verifyWebhook } from "@/lib/webhook-signature";

/**
 * Supabase's Send Email Hook.
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
 * Runs on Node: the signature check needs `node:crypto`, and the renderer is
 * React. Not matched by `src/proxy.ts`, which skips `/api` — there is no session
 * here to refresh and nothing to gain from a round trip to Supabase.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase's own default. Shown in the message so a stale link is explicable. */
const TOKEN_MINUTES = "60";

/** Standard Webhooks says every response carries JSON, errors included. */
function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
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
    site_url?: string;
  };
}

/**
 * Where the link should land, and whether we are willing to send people there.
 *
 * `redirect_to` is echoed back from the request that started the sign-in, and
 * Supabase has already checked it against the project's allow-list. This checks
 * it again anyway: the value ends up inside an email as a clickable link, and
 * "someone else validated it" is not a property this code can see. An origin we
 * do not recognise falls back to the site URL rather than being trusted.
 *
 * The `next` inside it is carried through untouched — the callback validates it
 * as a relative path, which is where that check belongs.
 */
function callbackUrl(tokenHash: string, type: string, redirectTo: string, siteUrl: string): string {
  const site = new URL(siteUrl);

  let target: URL;
  try {
    target = new URL(redirectTo);
  } catch {
    target = site;
  }

  const allowed =
    target.origin === site.origin ||
    target.hostname === "localhost" ||
    target.hostname === "127.0.0.1";

  const origin = allowed ? target.origin : site.origin;
  const next = target.searchParams.get("next");

  const url = new URL("/auth/callback", origin);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  if (next) url.searchParams.set("next", next);

  return url.toString();
}

export async function POST(request: NextRequest) {
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

  const siteUrl = data.site_url ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
  const url = callbackUrl(
    data.token_hash,
    data.email_action_type,
    data.redirect_to ?? siteUrl,
    siteUrl,
  );

  /*
    The reader's language, chosen at sign-in and stored on the account — see the
    `data` passed to `signInWithOtp`. This is the thing Supabase's own templates
    could never do: they are one language for everybody.
  */
  const stored = payload.user?.user_metadata?.locale;
  const locale = typeof stored === "string" && isLocale(stored) ? stored : DEFAULT_LOCALE;

  const result = await sendMessage({
    to: email,
    template: "auth-link",
    locale,
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
}
