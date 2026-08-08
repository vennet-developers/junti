import "@/server/assert-server";

import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { db } from "@/db/client";
import { credits, participants, payments } from "@/db/schema";
import { allocate, balanceOf, type CreditRow } from "@/domain/credits";

/**
 * Standing credit, from the database side.
 *
 * **The ledger never stores a discounted ask.** A pending payment row keeps
 * the full share; what somebody is asked to transfer is worked out live from
 * whatever they are owed at that moment. Writing the discount into the row
 * would freeze a claim on money that might be spent on another event first,
 * and leave stale rows behind every time a balance moved.
 *
 * The credit is therefore spent at exactly one instant — when a payment is
 * confirmed — inside a transaction that re-reads what is available. Two
 * organizers confirming at once cannot spend the same peso twice.
 */

function toRow(row: {
  id: string;
  amountMinor: number;
  appliedMinor: number;
  currency: string;
  settledAt: Date | null;
  createdAt: Date;
}): CreditRow {
  return row;
}

/**
 * What this organizer owes each of these people, in one currency.
 *
 * One query for the whole roster rather than one per participant — this runs
 * on every read of an event page, and the pooler has five connections.
 */
export async function loadBalances(
  organizerId: string,
  userIds: readonly string[],
  currency: string,
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (userIds.length === 0) return balances;

  const rows = await db
    .select({
      id: credits.id,
      userId: credits.userId,
      amountMinor: credits.amountMinor,
      appliedMinor: credits.appliedMinor,
      currency: credits.currency,
      settledAt: credits.settledAt,
      createdAt: credits.createdAt,
    })
    .from(credits)
    .where(
      and(
        eq(credits.organizerId, organizerId),
        inArray(credits.userId, [...userIds]),
        eq(credits.currency, currency),
        isNull(credits.settledAt),
      ),
    );

  const byUser = new Map<string, CreditRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(toRow(row));
    byUser.set(row.userId, list);
  }

  for (const [userId, list] of byUser) {
    balances.set(userId, balanceOf(list, currency));
  }

  return balances;
}

/**
 * Records that the organizer is keeping somebody's surplus toward next time.
 *
 * Called from the settlement card's third answer. The amount is whatever the
 * split says they are ahead by; the caller has already reconciled the payment
 * so the money leaves that event's books as it enters the person's balance —
 * the same peso must not be counted in both places.
 */
export async function creditOverpayment(input: {
  userId: string;
  organizerId: string;
  amountMinor: number;
  currency: string;
  originEventId: string;
}): Promise<void> {
  if (input.amountMinor <= 0) return;

  await db.insert(credits).values({
    id: uuidv7(),
    userId: input.userId,
    organizerId: input.organizerId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    originEventId: input.originEventId,
  });
}

/**
 * Spends what it can of somebody's balance against a payment being confirmed,
 * and returns how much it spent.
 *
 * In one transaction, re-reading availability inside it: the balance shown on
 * a page a minute ago is a snapshot, and the only number that may be spent is
 * the one true at the moment of writing.
 *
 * `askMinor` is the FULL share, not the discounted figure — the discount is
 * this function's output, not its input.
 */
export async function spendCreditsOnConfirm(input: {
  participantId: string;
  userId: string | null;
  organizerId: string;
  currency: string;
  askMinor: number;
}): Promise<number> {
  const userId = input.userId;
  if (!userId || input.askMinor <= 0) return 0;

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: credits.id,
        amountMinor: credits.amountMinor,
        appliedMinor: credits.appliedMinor,
        currency: credits.currency,
        settledAt: credits.settledAt,
        createdAt: credits.createdAt,
      })
      .from(credits)
      .where(
        and(
          eq(credits.organizerId, input.organizerId),
          eq(credits.userId, userId),
          eq(credits.currency, input.currency),
          isNull(credits.settledAt),
        ),
      )
      .orderBy(asc(credits.createdAt))
      .for("update");

    const allocations = allocate(rows.map(toRow), input.currency, input.askMinor);
    if (allocations.length === 0) return 0;

    for (const allocation of allocations) {
      await tx
        .update(credits)
        .set({ appliedMinor: sql`${credits.appliedMinor} + ${allocation.amountMinor}` })
        .where(eq(credits.id, allocation.creditId));
    }

    const applied = allocations.reduce((sum, one) => sum + one.amountMinor, 0);

    /*
      The payment records both halves: what was transferred (the share minus
      the credit) and what the credit covered. Together they add back up to
      the share, which is what keeps a credited payer out of the "still owes"
      list.
    */
    await tx
      .update(payments)
      .set({ amountMinor: Math.max(0, input.askMinor - applied), creditAppliedMinor: applied })
      .where(eq(payments.participantId, input.participantId));

    return applied;
  });
}

/**
 * Hands a credit back when a confirmation is undone.
 *
 * Without this, an organizer correcting a mistaken "Pagó" would quietly
 * destroy money somebody was owed — the payment goes back to pending and the
 * credit stays spent on it.
 */
export async function releaseCredits(participantId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [payment] = await tx
      .select({ creditAppliedMinor: payments.creditAppliedMinor })
      .from(payments)
      .where(eq(payments.participantId, participantId))
      .limit(1);

    if (!payment || payment.creditAppliedMinor <= 0) return;

    const [row] = await tx
      .select({ userId: participants.userId, eventId: participants.eventId })
      .from(participants)
      .where(eq(participants.id, participantId))
      .limit(1);
    const userId = row?.userId;
    if (!userId) return;

    /*
      Given back to the newest debts first — the mirror of spending oldest
      first, so a balance that was partly spent returns to the shape it had.
    */
    const owed = await tx
      .select({ id: credits.id, appliedMinor: credits.appliedMinor })
      .from(credits)
      .where(and(eq(credits.userId, userId), sql`${credits.appliedMinor} > 0`))
      .orderBy(asc(credits.createdAt))
      .for("update");

    let toReturn = payment.creditAppliedMinor;
    for (const credit of [...owed].reverse()) {
      if (toReturn <= 0) break;
      const give = Math.min(credit.appliedMinor, toReturn);
      await tx
        .update(credits)
        .set({ appliedMinor: sql`${credits.appliedMinor} - ${give}` })
        .where(eq(credits.id, credit.id));
      toReturn -= give;
    }

    await tx
      .update(payments)
      .set({ creditAppliedMinor: 0 })
      .where(eq(payments.participantId, participantId));
  });
}

export interface CreditView {
  id: string;
  amountMinor: number;
  availableMinor: number;
  currency: string;
  counterpartId: string;
  originEventTitle: string | null;
  createdAt: Date;
}

/** Everything one person is owed, across organizers. Their side of the ledger. */
export async function loadCreditsOwedTo(userId: string): Promise<CreditView[]> {
  const { events } = await import("@/db/schema");

  const rows = await db
    .select({
      id: credits.id,
      amountMinor: credits.amountMinor,
      appliedMinor: credits.appliedMinor,
      currency: credits.currency,
      organizerId: credits.organizerId,
      title: events.title,
      createdAt: credits.createdAt,
      settledAt: credits.settledAt,
    })
    .from(credits)
    .leftJoin(events, eq(events.id, credits.originEventId))
    .where(and(eq(credits.userId, userId), isNull(credits.settledAt)))
    .orderBy(asc(credits.createdAt));

  return rows
    .map((row) => ({
      id: row.id,
      amountMinor: row.amountMinor,
      availableMinor: Math.max(0, row.amountMinor - row.appliedMinor),
      currency: row.currency,
      counterpartId: row.organizerId,
      originEventTitle: row.title,
      createdAt: row.createdAt,
    }))
    .filter((row) => row.availableMinor > 0);
}

/** Everything one organizer owes. The side that makes them settle up. */
export async function loadCreditsOwedBy(organizerId: string): Promise<CreditView[]> {
  const { events } = await import("@/db/schema");

  const rows = await db
    .select({
      id: credits.id,
      amountMinor: credits.amountMinor,
      appliedMinor: credits.appliedMinor,
      currency: credits.currency,
      userId: credits.userId,
      title: events.title,
      createdAt: credits.createdAt,
    })
    .from(credits)
    .leftJoin(events, eq(events.id, credits.originEventId))
    .where(and(eq(credits.organizerId, organizerId), isNull(credits.settledAt)))
    .orderBy(asc(credits.createdAt));

  return rows
    .map((row) => ({
      id: row.id,
      amountMinor: row.amountMinor,
      availableMinor: Math.max(0, row.amountMinor - row.appliedMinor),
      currency: row.currency,
      counterpartId: row.userId,
      originEventTitle: row.title,
      createdAt: row.createdAt,
    }))
    .filter((row) => row.availableMinor > 0);
}

/** Closes a debt the organizer settled outside the app. */
export async function settleCredit(creditId: string, organizerId: string): Promise<boolean> {
  const updated = await db
    .update(credits)
    .set({ settledAt: new Date() })
    .where(and(eq(credits.id, creditId), eq(credits.organizerId, organizerId)))
    .returning({ id: credits.id });

  return updated.length > 0;
}
