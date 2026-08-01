import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { ROUTES, signInPath } from "@/config/routes";
import { applyStoredPreferences } from "@/lib/preferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where Google and the email links land.
 *
 * Supabase hands back the session in one of two shapes, and a callback that
 * only understands one silently fails on the other:
 *
 * 1. **`?code=`** — the PKCE flow. Used when the sign-in was STARTED in this
 *    browser (`signInWithOAuth`, `signInWithOtp`), because the client stored a
 *    code verifier for the exchange. This is the normal path.
 *
 * 2. **`?token_hash=&type=`** — a link verified without a stored verifier: an
 *    admin-generated link, or an email opened somewhere other than where it was
 *    requested. `verifyOtp` handles it.
 *
 * There is a third shape, `#access_token=` in the URL fragment, and it cannot be
 * handled here at all — fragments are never sent to the server. It appears only
 * on the implicit flow, which this project does not use.
 *
 * Runs on Node: the cookie helpers need it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  // Relative paths only — an absolute `next` would make this an open redirect.
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : ROUTES.myEvents;

  /**
   * Back to sign-in, saying why and remembering where they were going.
   *
   * Both halves were missing. The reason was sent as `?error=1` and the
   * sign-in page never read it, so a failed link produced a blank form and no
   * account of what had happened — which is indistinguishable from the app
   * having simply forgotten the request. And `next` was dropped, so somebody
   * who signed in on the second attempt landed on their event list rather than
   * the event they had been invited to.
   */
  function failed(reason: "browser" | "link"): NextResponse {
    const back = signInPath(destination);
    return NextResponse.redirect(
      `${origin}${back}${back.includes("?") ? "&" : "?"}error=${reason}`,
    );
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // The one moment we know both who they are and that this device may
      // never have seen them: copy their saved settings onto it.
      if (data.user) await applyStoredPreferences(data.user.id);
      return NextResponse.redirect(`${origin}${destination}`);
    }

    /*
      `bad_code_verifier` is worth telling apart, because it is the one failure
      with a specific instruction attached. PKCE keeps the verifier in a cookie
      belonging to the origin that STARTED the sign-in, so this is what a link
      opened in a different browser — or landing on a different origin than the
      one that asked — looks like from here. "Try again" does not help; "open it
      where you asked for it" does.
    */
    return failed(error.code === "bad_code_verifier" ? "browser" : "link");
  }

  if (tokenHash && type) {
    const { error, data } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      if (data.user) await applyStoredPreferences(data.user.id);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return failed("link");
}
