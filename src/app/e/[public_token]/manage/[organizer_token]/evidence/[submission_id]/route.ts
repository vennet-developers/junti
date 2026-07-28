import { NextResponse, type NextRequest } from "next/server";

import { getEvidence } from "@/lib/evidence-store";
import { resolveEventLocale } from "@/lib/locale";
import { getCurrentUser } from "@/lib/supabase/server";
import { authorizeOrganizer, findSubmissionInEvent } from "@/lib/roster";

/**
 * Serves an uploaded receipt.
 *
 * **This route is the entire access control for evidence.** The image never
 * appears in any page's props, never reaches the participant view, and has no
 * other way out of the database — so "only the organizer sees it" is enforced
 * in one place instead of being a rule every component has to remember.
 *
 * Two independent checks, both required:
 *
 * 1. The caller is the organizer of the event named in the path — by token, or
 *    by owning it while signed in. The organizer token sits in the URL, so this
 *    is the same authority that lets them mark payments.
 * 2. The submission belongs to *that* event. Without it, an organizer of any
 *    event could read any submission in the database by guessing an id.
 *
 * A receipt carries someone's full name, phone number and bank. That is why it
 * is behind the organizer link and not on the roster the whole group chat can
 * open.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ public_token: string; organizer_token: string; submission_id: string }>;
  },
) {
  const { public_token, organizer_token, submission_id } = await context.params;

  const user = await getCurrentUser();
  const event = await authorizeOrganizer(public_token, organizer_token, user?.id ?? null);

  if (!event) {
    return new NextResponse(null, { status: 404 });
  }

  const submission = await findSubmissionInEvent(
    event.id,
    submission_id,
    await resolveEventLocale(event.locale),
  );

  if (!submission) {
    return new NextResponse(null, { status: 404 });
  }

  const evidence = await getEvidence(submission_id);

  if (!evidence) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(evidence.bytes), {
    status: 200,
    headers: {
      "Content-Type": evidence.mimeType,
      "Content-Length": String(evidence.sizeBytes),
      /**
       * `no-store` rather than a private cache: the URL contains the organizer
       * token, and a copy left in a shared or proxy cache would outlive the
       * decision to stop sharing that link.
       */
      "Cache-Control": "no-store, private",
      /** Never render it as a document, whatever the sniffer concluded. */
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
