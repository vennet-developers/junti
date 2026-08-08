/**
 * Standing credit: what one organizer owes one person, waiting for the next
 * event they share.
 *
 * Pure arithmetic over rows, so the part that decides how much somebody is
 * asked for can be tested without a database. Everything here is in minor
 * units and never converts between currencies — an organizer running events
 * in two of them owes two separate debts.
 */

export interface CreditRow {
  id: string;
  amountMinor: number;
  /** How much of it has already been spent on earlier events. */
  appliedMinor: number;
  currency: string;
  /** Set when the organizer settled it outside the app; closes the remainder. */
  settledAt: Date | null;
  /** Oldest first is the order it gets spent in. */
  createdAt: Date;
}

/** What is still on the table for one credit. Never negative. */
export function availableOf(credit: CreditRow): number {
  if (credit.settledAt !== null) return 0;
  return Math.max(0, credit.amountMinor - credit.appliedMinor);
}

/**
 * The whole balance owed in one currency.
 *
 * Filtering by currency here rather than at the query keeps the rule in the
 * domain: a COP credit may not discount a USD event, and the reason is not a
 * missing index.
 */
export function balanceOf(credits: readonly CreditRow[], currency: string): number {
  return credits
    .filter((credit) => credit.currency === currency)
    .reduce((sum, credit) => sum + availableOf(credit), 0);
}

export interface Allocation {
  creditId: string;
  amountMinor: number;
}

/**
 * Decides which credits pay for how much of one ask.
 *
 * **Oldest first**, so a debt cannot sit forever behind newer ones — the
 * money somebody has been owed longest is the money they get back first.
 * Stops the moment the ask is covered, so a large credit is spent partially
 * and keeps its remainder for next time rather than being consumed whole.
 *
 * Returns the pieces rather than a single number because each piece has to be
 * written back to its own row; the caller sums them for what the payment
 * records.
 */
export function allocate(
  credits: readonly CreditRow[],
  currency: string,
  askMinor: number,
): Allocation[] {
  if (askMinor <= 0) return [];

  const usable = credits
    .filter((credit) => credit.currency === currency && availableOf(credit) > 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

  const allocations: Allocation[] = [];
  let remaining = askMinor;

  for (const credit of usable) {
    if (remaining <= 0) break;
    const take = Math.min(availableOf(credit), remaining);
    allocations.push({ creditId: credit.id, amountMinor: take });
    remaining -= take;
  }

  return allocations;
}
