import "@/server/assert-server";

import { and, asc, eq, isNotNull, lte, or, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { outboxMessages } from "@/db/schema";
import {
  dedupeKey,
  nextAttemptAt,
  nextStatus,
  type OutboxStatus,
} from "@/domain/outbox";
import { sendMessage } from "@/lib/email/provider";
import { suppressedAmong } from "@/lib/consent";
import type { OutboundAttachment, OutboundMessage } from "@/lib/email/port";

/**
 * Write it down, then send it.
 *
 * The order is the whole point. `notify()` used to send and swallow the
 * result, which meant a message that never went out left no trace anywhere —
 * correct, in that a provider must not undo a recorded RSVP, and the reason
 * nobody could answer "did the invitation actually go?".
 *
 * Now the row is written first. The send still happens immediately, because
 * nobody should wait on a queue for an email they just triggered; the sweep is
 * a safety net for what failed, not the mechanism.
 */

export interface EnqueueInput {
  message: OutboundMessage;
  /** The event this belongs to, for the dedupe key. Auth links have none. */
  eventId?: string | null;
  /** What caused it. `resend:<n>` is what lets a deliberate second copy through. */
  trigger?: string | null;
}

interface StoredPayload {
  values: Record<string, string>;
  attachments?: OutboundAttachment[];
  sandbox?: boolean;
}

/**
 * Records a message, or recognises it as one already recorded.
 *
 * Returns the row id, or null when this exact message is already in the table
 * — which is where idempotency lives. `onConflictDoNothing` rather than a read
 * followed by an insert: two invitations dispatched in the same instant would
 * otherwise both find nothing and both insert.
 *
 * Takes an optional transaction so a caller can write this alongside the
 * domain change it belongs to. That is what closes the "event created, no
 * email" gap the card names; callers that pass nothing get the older, weaker
 * guarantee of "written before sent".
 */
export async function enqueue(
  input: EnqueueInput,
  tx: Pick<typeof db, "insert"> = db,
): Promise<string | null> {
  const key = dedupeKey({
    template: input.message.template,
    recipient: input.message.to,
    eventId: input.eventId,
    trigger: input.trigger,
  });

  const payload: StoredPayload = {
    values: input.message.values,
    attachments: input.message.attachments,
    sandbox: input.message.sandbox,
  };

  const [row] = await tx
    .insert(outboxMessages)
    .values({
      id: uuidv7(),
      dedupeKey: key,
      template: input.message.template,
      recipient: input.message.to,
      locale: input.message.locale,
      payload,
      status: "pending",
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({ target: outboxMessages.dedupeKey })
    .returning({ id: outboxMessages.id });

  return row?.id ?? null;
}

/**
 * Tries one row, and records what happened to it.
 *
 * Never throws. A dispatcher that can fail is a dispatcher that stops the
 * sweep at the first bad row, and the whole point of the sweep is to get
 * through the ones after it.
 */
export async function dispatchOne(id: string): Promise<OutboxStatus> {
  try {
    const [row] = await db
      .select()
      .from(outboxMessages)
      .where(eq(outboxMessages.id, id))
      .limit(1);

    if (!row || row.status !== "pending") return (row?.status as OutboxStatus) ?? "failed";

    const payload = row.payload as StoredPayload;
    const attempts = row.attempts + 1;

    // The suppression list is checked here rather than at the port, for the
    // same reason it always was: "should this person be written to" is a
    // question about consent, not transport. Checked per attempt, because
    // somebody may have unsubscribed between the enqueue and the retry.
    const suppressed = (await suppressedAmong([row.recipient])).size > 0;

    const result = suppressed
      ? ({ status: "suppressed" } as const)
      : await sendMessage({
          to: row.recipient,
          template: row.template as OutboundMessage["template"],
          locale: row.locale,
          values: payload.values,
          attachments: payload.attachments,
          sandbox: payload.sandbox,
        });

    const status = nextStatus(
      result.status === "sent" ? "sent" : result.status === "suppressed" ? "suppressed" : "failed",
      attempts,
    );

    await db
      .update(outboxMessages)
      .set({
        status,
        attempts,
        sentAt: status === "sent" ? new Date() : null,
        // Cleared once terminal, so the sweep's index only ever holds rows
        // that are actually waiting for something.
        nextAttemptAt: status === "pending" ? nextAttemptAt(attempts, new Date()) : null,
        lastError: result.status === "failed" ? result.reason.slice(0, 500) : null,
      })
      .where(eq(outboxMessages.id, id));

    return status;
  } catch (error) {
    // Record the failure rather than losing it, and keep going.
    await db
      .update(outboxMessages)
      .set({
        attempts: sql`${outboxMessages.attempts} + 1`,
        lastError: String(error).slice(0, 500),
        nextAttemptAt: nextAttemptAt(1, new Date()),
      })
      .where(eq(outboxMessages.id, id))
      .catch(() => {});

    return "pending";
  }
}

/**
 * Writes the message down and tries it now.
 *
 * What almost every call site wants. Returns what happened, for a caller that
 * cares; nobody has to check.
 */
export async function enqueueAndSend(input: EnqueueInput): Promise<OutboxStatus | "duplicate"> {
  const id = await enqueue(input);
  if (!id) return "duplicate";
  return dispatchOne(id);
}

export interface SweepReport {
  tried: number;
  sent: number;
  stillPending: number;
  failed: number;
}

/**
 * Everything pending and due, oldest first.
 *
 * Bounded, because an unbounded sweep on a cold serverless function is how a
 * backlog turns into a timeout that never gets far enough to clear itself.
 * What it does not finish, the next run picks up.
 */
export async function dispatchPending(limit = 50): Promise<SweepReport> {
  const due = await db
    .select({ id: outboxMessages.id })
    .from(outboxMessages)
    .where(
      and(
        eq(outboxMessages.status, "pending"),
        or(
          lte(outboxMessages.nextAttemptAt, new Date()),
          // A row with no scheduled time has never been tried — it was
          // enqueued by a process that died before dispatching it, which is
          // exactly the case this table exists for.
          sql`${outboxMessages.nextAttemptAt} is null`,
        ),
      ),
    )
    .orderBy(asc(outboxMessages.createdAt))
    .limit(limit);

  const report: SweepReport = { tried: 0, sent: 0, stillPending: 0, failed: 0 };

  // Sequential on purpose. These all hit the same provider, and a burst of
  // fifty concurrent sends is how a rate limit turns a backlog into a bigger
  // backlog.
  for (const row of due) {
    const status = await dispatchOne(row.id);
    report.tried += 1;
    if (status === "sent") report.sent += 1;
    else if (status === "pending") report.stillPending += 1;
    else if (status === "failed") report.failed += 1;
  }

  return report;
}

/** What an operator needs to see: what is stuck, and why. */
export async function outboxHealth(): Promise<{
  pending: number;
  failed: number;
  recentErrors: { template: string; error: string; attempts: number }[];
}> {
  const [counts] = await db
    .select({
      pending: sql<string>`count(*) filter (where status = 'pending')`,
      failed: sql<string>`count(*) filter (where status = 'failed')`,
    })
    .from(outboxMessages);

  const recentErrors = await db
    .select({
      template: outboxMessages.template,
      error: outboxMessages.lastError,
      attempts: outboxMessages.attempts,
    })
    .from(outboxMessages)
    .where(and(isNotNull(outboxMessages.lastError), eq(outboxMessages.status, "failed")))
    .orderBy(asc(outboxMessages.createdAt))
    .limit(10);

  return {
    pending: Number(counts?.pending ?? 0),
    failed: Number(counts?.failed ?? 0),
    recentErrors: recentErrors.map((row) => ({
      template: row.template,
      error: row.error ?? "",
      attempts: row.attempts,
    })),
  };
}

/** Rows that are done and old enough to forget. Called by the retention job. */
export { outboxMessages };
