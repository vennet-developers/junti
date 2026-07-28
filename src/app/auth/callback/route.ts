import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/mis-eventos";

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // The one moment we know both who they are and that this device may
      // never have seen them: copy their saved settings onto it.
      if (data.user) await applyStoredPreferences(data.user.id);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  } else if (tokenHash && type) {
    const { error, data } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      if (data.user) await applyStoredPreferences(data.user.id);
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar?error=1`);
}
