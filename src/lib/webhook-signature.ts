import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks signature verification.
 *
 * Supabase signs its Auth hooks to the [Standard Webhooks](https://www.standardwebhooks.com/)
 * specification, and this is the whole of it. Written out rather than pulled
 * from the `standardwebhooks` package for the same reason `resend.tsx` posts
 * with `fetch` instead of an SDK: the scheme is an HMAC over three strings, and
 * a dependency here would be a version to track for thirty lines of code.
 *
 * **This is the only thing standing between the send-email hook and anybody on
 * the internet.** The endpoint has to be public — Supabase calls it from their
 * infrastructure — so an unverified request is a stranger able to make this app
 * email an arbitrary address with an arbitrary link in it. Every failure path
 * below returns false rather than throwing, and the caller refuses the request.
 */

/**
 * How far out of step a request's clock may be, in seconds.
 *
 * Without this the signature alone would let a captured request be replayed
 * forever. Five minutes is the specification's own suggestion and is generous
 * enough for ordinary clock drift between two servers.
 */
const TOLERANCE_SECONDS = 5 * 60;

export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/**
 * The signing key, from the value Supabase shows in the dashboard.
 *
 * That value looks like `v1,whsec_<base64>`. The `v1,` names the scheme and the
 * `whsec_` says the secret is symmetric; neither is part of the key, and
 * including them produces a signature that never matches — which is the single
 * most common way this is got wrong.
 */
function decodeSecret(secret: string): Buffer {
  const base64 = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  return Buffer.from(base64, "base64");
}

/** Constant-time compare of two base64 signatures. */
function matches(a: string, b: string): boolean {
  const left = Buffer.from(a, "base64");
  const right = Buffer.from(b, "base64");

  // timingSafeEqual throws on a length mismatch, which would leak the answer
  // through an exception instead of a return value.
  if (left.length !== right.length || left.length === 0) return false;

  return timingSafeEqual(left, right);
}

/**
 * Whether this body really came from the holder of the secret.
 *
 * `body` must be the RAW request text. Parsing and re-serialising the JSON
 * first changes key order and whitespace, and the signature is over bytes — so
 * a round trip through `JSON.parse` produces a valid payload that never
 * verifies.
 *
 * `nowSeconds` is injected so the replay window can be tested without waiting
 * five minutes.
 */
export function verifyWebhook(
  body: string,
  headers: WebhookHeaders,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;

  if (!id || !timestamp || !signature || !secret) return false;

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) return false;
  if (Math.abs(nowSeconds - sent) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", decodeSecret(secret))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  /*
    The header carries a space-separated list, because the specification allows
    several signatures at once so a secret can be rotated without a moment where
    neither key works. Any one of them matching is enough.
  */
  return signature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .some((part) => matches(part.slice(3), expected));
}
