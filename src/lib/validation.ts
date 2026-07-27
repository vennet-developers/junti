import { z } from "zod";

import { copy } from "@/config/copy";

import { fromDateTimeLocalValue, toMinorUnits } from "./format";

/**
 * Zod schemas for every input boundary.
 *
 * Everything arriving from a form is a string, so these schemas do the parsing
 * as well as the validating — a route or action never sees a raw FormData
 * value. Error messages come from `copy.ts` so they stay in one place and in
 * Spanish.
 */

const TITLE_MAX = 120;
const NAME_MAX = 40;
const NOTES_MAX = 2000;
const LOCATION_MAX = 200;

/** Trims, then treats an empty string as absent. Forms send "" for untouched fields. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .catch(null);

export const eventKindSchema = z.enum(["match", "party", "kids_party", "other"]);
export const costModeSchema = z.enum(["none", "total", "per_person"]);
export const paymentStatusSchema = z.enum(["pending", "confirmed", "waived"]);

/** What a participant may choose. `waitlisted` is assigned by the server, never requested. */
export const rsvpAttendanceSchema = z.enum(["in", "out", "maybe"], {
  message: copy.errors.attendanceInvalid,
});

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3)
  .regex(/^[A-Z]{3}$/)
  .default("COP");

/** `datetime-local` wall-clock text interpreted as Bogota time. */
const startsAtSchema = z
  .string()
  .min(1, copy.errors.startsAtRequired)
  .transform((value, ctx) => {
    const parsed = fromDateTimeLocalValue(value);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: copy.errors.startsAtInvalid });
      return z.NEVER;
    }
    return parsed;
  });

/** Empty means unlimited. Otherwise a whole number of people, at least one. */
const capacitySchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value.length === 0) return null;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      ctx.addIssue({ code: "custom", message: copy.errors.capacityInvalid });
      return z.NEVER;
    }
    return parsed;
  });

/**
 * The money amount, entered in major units (pesos) and stored in minor units.
 *
 * Accepts the separators a Colombian would actually type — `50.000`, `50 000`,
 * `50,000` — because rejecting them would be pedantic and the intent is never
 * ambiguous for a whole-peso currency.
 */
const costAmountSchema = z.string().trim();

function parseCostAmount(
  raw: string,
  currency: string,
  ctx: z.RefinementCtx,
  path: string,
): number | null {
  const cleaned = raw.replace(/[\s.,]/g, "");

  if (cleaned.length === 0) {
    ctx.addIssue({ code: "custom", message: copy.errors.costRequired, path: [path] });
    return null;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    ctx.addIssue({ code: "custom", message: copy.errors.costInvalid, path: [path] });
    return null;
  }

  return toMinorUnits(parsed, currency);
}

/** Shared shape of the create and edit forms. */
const eventFieldsSchema = z.object({
  title: z.string().trim().min(1, copy.errors.titleRequired).max(TITLE_MAX, copy.errors.titleTooLong),
  kind: eventKindSchema,
  startsAt: startsAtSchema,
  location: optionalText(LOCATION_MAX),
  capacity: capacitySchema,
  notes: optionalText(NOTES_MAX),
  costMode: costModeSchema,
  costAmount: costAmountSchema,
  currency: currencySchema,
});

/**
 * Resolves the amount against the cost mode: required when there is a cost,
 * discarded when there isn't. Applied after the object parses so both fields
 * are available.
 *
 * Create and edit share this schema — the fields are identical, and letting
 * them drift would be how the edit form quietly stops validating something.
 */
export const eventSchema = eventFieldsSchema.transform((parsed, ctx) => {
  if (parsed.costMode === "none") {
    return { ...parsed, costAmountMinor: null as number | null };
  }

  const costAmountMinor = parseCostAmount(parsed.costAmount, parsed.currency, ctx, "costAmount");

  if (costAmountMinor === null) return z.NEVER;

  return { ...parsed, costAmountMinor };
});

export type EventInput = z.infer<typeof eventSchema>;

export const rsvpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, copy.errors.nameRequired)
    .max(NAME_MAX, copy.errors.nameTooLong),
  attendance: rsvpAttendanceSchema,
});

export type RsvpInput = z.infer<typeof rsvpSchema>;

export const addParticipantSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, copy.errors.nameRequired)
    .max(NAME_MAX, copy.errors.nameTooLong),
  attendance: rsvpAttendanceSchema,
});

export const participantIdSchema = z.uuid();

export const setPaymentStatusSchema = z.object({
  participantId: participantIdSchema,
  status: paymentStatusSchema,
  method: optionalText(60),
});

/** Reads a single field from FormData as a string, defaulting to empty. */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Flattens Zod issues into `{ fieldName: message }` for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    const name = typeof key === "string" ? key : "_form";
    result[name] ??= issue.message;
  }

  return result;
}
