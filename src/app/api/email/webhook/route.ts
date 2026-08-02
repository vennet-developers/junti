import { NextResponse, type NextRequest } from "next/server";

import { suppressEmail } from "@/lib/consent";
import { verifyWebhook } from "@/lib/webhook-signature";

/**
 * Resend's delivery feedback.
 *
 * The suppression list has been gating every non-auth send since it was built,
 * but only a human clicking "unsubscribe" ever wrote to it. This is the other
 * writer, and it is the one that matters for reputation: an address that hard
 * bounces does not exist, and one that files a complaint has told a mailbox
 * provider — not us — that our mail is spam. Continuing to write to either is
 * how a sending domain gets itself blacklisted.
 *
 * **Resend signs with Standard Webhooks**, the same scheme as Supabase's auth
 * hook, so the verification is `verifyWebhook` unchanged. Same reasoning too:
 * this endpoint is public because a provider calls it, and an unverified request
 * is a stranger able to silence any address they like — which is a denial of
 * service against a person, not just against us.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which events retire an address, and which are only news.
 *
 * `bounced` is narrower than it looks: Resend reports soft bounces under the
 * same name, and a full mailbox is not a dead one. `bounce.type` separates
 * them, and **its vocabulary is Amazon SES's, not a friendly one** —
 * `Permanent`, `Transient`, `Undetermined`. This first shipped checking for
 * `"hard"`, a word that appears nowhere in the payload, so every bounce was
 * received and quietly ignored. It took firing a real one to notice, because
 * an endpoint that returns 200 and does nothing looks exactly like one that
 * works.
 *
 * Only `Permanent` suppresses. `Transient` is a full mailbox or a server having
 * a moment; `Undetermined` is the provider admitting it does not know, and
 * retiring an address on a guess is worse than sending one more message.
 *
 * `delivered` and `opened` arrive too and are deliberately ignored. Recording
 * who opened what would be tracking, which this project does not do — the
 * domain has click and open tracking switched off at the provider for the same
 * reason.
 */
const PERMANENT_BOUNCE = "permanent";
interface ResendEvent {
  type?: string;
  data?: {
    to?: string[] | string;
    bounce?: { type?: string };
  };
}

function recipients(data: ResendEvent["data"]): string[] {
  const to = data?.to;
  if (!to) return [];
  return (Array.isArray(to) ? to : [to]).filter((value) => typeof value === "string");
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "";

  // Refused rather than waved through, exactly as the auth hook does. An
  // unconfigured secret here would let anyone suppress anyone.
  if (!secret) return json({ error: "webhook not configured" }, 500);

  const body = await request.text();

  const valid = verifyWebhook(
    body,
    {
      id: request.headers.get("svix-id") ?? request.headers.get("webhook-id"),
      timestamp: request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp"),
      signature: request.headers.get("svix-signature") ?? request.headers.get("webhook-signature"),
    },
    secret,
  );

  if (!valid) return json({ error: "invalid signature" }, 401);

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return json({ error: "malformed payload" }, 400);
  }

  const complained = event.type === "email.complained";

  // Lower-cased before comparing: the field is somebody else's enum and its
  // capitalisation is not a promise anybody made to us.
  const bounceType = event.data?.bounce?.type?.trim().toLowerCase();
  const hardBounce = event.type === "email.bounced" && bounceType === PERMANENT_BOUNCE;

  if (complained || hardBounce) {
    for (const email of recipients(event.data)) {
      await suppressEmail(email, complained ? "complained" : "bounced");
    }
  }

  /*
    200 for everything, including events we do nothing with. A provider retries
    what it reads as a failure, and being retried forever for a `delivered`
    notification this app has no interest in is a cost with no benefit.
  */
  return json({});
}
