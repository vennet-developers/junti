/**
 * Domain vocabulary.
 *
 * Declared here rather than imported from the database layer so that
 * `src/domain` stays free of framework and ORM imports. The database enums in
 * `src/db/schema.ts` are structurally identical; `src/lib/roster.ts` is the one
 * place that maps between the two, and TypeScript checks the mapping.
 */

export type Attendance = "in" | "out" | "maybe" | "waitlisted";

export type CostMode = "none" | "total" | "per_person";

export type PaymentStatus = "pending" | "confirmed" | "waived";

/** The only attendance value that owes money or occupies a slot. */
export const ATTENDING: Attendance = "in";
