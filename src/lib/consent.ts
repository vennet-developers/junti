import "@/server/assert-server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { consentEvents, emailSuppressions, invitations } from "@/db/schema";

/**
 * Consent, as evidence rather than as a setting.
 *
 * Ley 1581 puts the burden of proof on whoever holds the data: not "do they
 * agree" but "show that they agreed, to what, and when". That is why nothing
 * here updates a row. Every grant and every revocation is an event, and the
 * current state is a question you answer by reading the most recent one.
 */

/**
 * The version of the privacy notice a consent was given against.
 *
 * Bump it when the notice's substance changes — a new purpose, a new
 * sub-processor, a new destination country — and NOT for a typo. Old rows keep
 * pointing at the text that was actually on screen, which is the only thing
 * that makes them evidence of anything.
 *
 * 2026-08-04: groups. One class of data left (addresses supplied by an
 * organizer, which are no longer stored at all) and another arrived (group
 * memberships, including the declines). A class leaving is as much a change of
 * substance as one arriving — the notice described something we were doing and
 * had stopped doing, which is worse than describing nothing.
 *
 * 2026-08-06: Google, by name. The notice now says what arrives when somebody
 * signs in with Google — name, email, profile photo — and what is never asked
 * for. Nothing about the processing changed; what changed is that the notice
 * did not mention the photo at all and named the sign-in only as "el correo es
 * cómo entras". Describing less than we hold is a change of substance in the
 * only direction that matters.
 *
 * 2026-08-06 (same day, second change): held spots. A new class of data —
 * guest names typed by the sponsor, possibly about non-users — with its
 * lifecycle stated: name only, self-deleting, removable on request. Two
 * substance changes sharing one version string is fine; the string names the
 * text that was on screen, and both changes shipped together.
 *
 * 2026-08-07: push subscriptions. A new class of data — the delivery
 * endpoint a browser mints when somebody turns device alerts on — with its
 * lifecycle stated: sends nothing but their own notifications, deleted on
 * opt-out or when the push service invalidates it. User-initiated and
 * per-device, but a stored technical address about a person is a stored
 * technical address, and the notice now says so.
 */
export const POLICY_VERSION = "2026-08-07";

/**
 * What can be consented to, separately.
 *
 * A closed union rather than free strings, for the same reason the message
 * templates are one: a purpose invented at a call site is a purpose nobody can
 * later query, revoke or report on.
 *
 * `organizer_whatsapp` is the only member today, and it is the only thing this
 * app collects that genuinely needs asking. Transactional mail about an event
 * somebody joined is not on this list on purpose — it is what the service does,
 * not a separate use of their data — but it still honours suppression.
 */
export type ConsentPurpose = "organizer_whatsapp";

export interface ConsentRecord {
  purpose: ConsentPurpose;
  channel: string;
  granted: boolean;
  sourceIp: string | null;
}

/** Writes one grant or revocation. Never updates. */
export async function recordConsent(userId: string, record: ConsentRecord): Promise<void> {
  await db.insert(consentEvents).values({
    id: uuidv7(),
    userId,
    purpose: record.purpose,
    channel: record.channel,
    granted: record.granted,
    policyVersion: POLICY_VERSION,
    sourceIp: record.sourceIp,
  });
}

/**
 * Whether this person currently agrees to a purpose.
 *
 * The most recent event wins. Absence is refusal, not permission — a person who
 * was never asked has not agreed, and defaulting the other way is how a consent
 * system becomes decorative.
 */
export async function hasConsent(userId: string, purpose: ConsentPurpose): Promise<boolean> {
  const [latest] = await db
    .select({ granted: consentEvents.granted })
    .from(consentEvents)
    .where(and(eq(consentEvents.userId, userId), eq(consentEvents.purpose, purpose)))
    .orderBy(desc(consentEvents.createdAt))
    .limit(1);

  return latest?.granted ?? false;
}

/**
 * Addresses that have asked to be left alone, out of the ones given.
 *
 * Takes a list and returns a Set rather than answering one at a time, because
 * the call site that matters is a pasted batch of invitations — and checking
 * twenty addresses one query each is how a suppression list quietly gets
 * skipped under load.
 */
export async function suppressedAmong(emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();

  const normalised = emails.map((email) => email.trim().toLowerCase());

  const rows = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(inArray(emailSuppressions.email, normalised));

  return new Set(rows.map((row) => row.email));
}

/**
 * The address behind an unsubscribe token.
 *
 * The token is the invitation's own id. That is what keeps the address out of
 * the URL — a link that says `?email=ana@correo.com` puts somebody's address in
 * their browser history, in any proxy log along the way, and in the referrer of
 * whatever they open next. It also means a forwarded link unsubscribes the
 * person it names rather than whoever clicked it.
 *
 * Reusing the id rather than minting a second secret: it is already unique,
 * already unguessable, already tied to exactly one person and one event, and
 * already deleted when the event is. A separate token column would be a second
 * thing to keep in step for no property this one lacks.
 *
 * Since invitations started naming accounts, the address is resolved here
 * rather than read off the row. The suppression list still works in addresses,
 * and it has to: it is the one protection that must keep working for somebody
 * who deleted their account, and an id would stop meaning anything then.
 *
 * Returns null for a token that matches nothing — an invitation deleted with
 * its event, or a link somebody mangled.
 */
export async function emailForUnsubscribeToken(token: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: invitations.userId })
    .from(invitations)
    .where(eq(invitations.id, token))
    .limit(1);

  if (!row) return null;

  const { loadVerifiedEmails } = await import("@/lib/accounts");
  const emails = await loadVerifiedEmails([row.userId]);

  return emails.get(row.userId) ?? null;
}

/**
 * Records that an address does not want to be written to again.
 *
 * Idempotent: unsubscribing twice is the same as once, and a second click on a
 * link somebody kept in their inbox must not error.
 */
export async function suppressEmail(email: string, reason = "unsubscribed"): Promise<void> {
  await db
    .insert(emailSuppressions)
    .values({ email: email.trim().toLowerCase(), reason })
    .onConflictDoNothing({ target: emailSuppressions.email });
}
