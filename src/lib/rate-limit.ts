import "@/server/assert-server";

/**
 * A fixed-window rate limiter held in the process's memory.
 *
 * This is deliberately the cheap version. The zero-cost constraint rules out
 * Redis or any hosted counter, and on Vercel each serverless instance keeps its
 * own map — so the real limit is (configured limit x number of warm instances).
 *
 * That is fine for what this defends against: a bored person hammering the
 * create-event form or an RSVP box from a phone. It is NOT a defence against a
 * distributed attack, and it is not pretending to be one. If this app ever
 * needs that, it needs a shared counter, and that costs money.
 *
 * See DECISIONS.md — "In-memory rate limiting".
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Stop the map growing without bound on a long-lived instance. */
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number): void {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets. Useful for a Retry-After header. */
  retryAfterSeconds: number;
};

/**
 * Consumes one token for `key`.
 *
 * @param key    Caller-namespaced identity, e.g. `create-event:203.0.113.7`.
 * @param limit  Requests allowed per window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP.
 *
 * On Vercel `x-forwarded-for` is set by the platform edge and is trustworthy.
 * Anywhere else it is a client-controlled header, so a determined caller can
 * spoof it — see the honesty note on `rateLimit` above. Falls back to a shared
 * bucket rather than failing open per-request.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
