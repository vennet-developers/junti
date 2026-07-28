import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where Google and the email magic link land.
 *
 * Supabase sends back a one-time `code`; exchanging it sets the session cookie.
 * Runs on Node because the Postgres driver and the cookie helpers need it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Relative paths only — an absolute `next` would make this an open redirect.
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/mis-eventos";

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?error=1`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?error=1`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
