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

/**
 * Wall-clock date and time, submitted separately by the Stackmyth pickers and
 * interpreted together as America/Bogota.
 *
 * Kept as two fields rather than one `datetime-local` string because
 * `DatePicker` and `TimePicker` are separate components. Neither part carries a
 * timezone on the wire; `fromDateTimeLocalValue` resolves the real Bogota
 * offset for that instant.
 */
export const startsAtDateSchema = z
  .string()
  .trim()
  .min(1, copy.errors.startsAtRequired)
  .regex(/^\d{4}-\d{2}-\d{2}$/, copy.errors.startsAtInvalid);

export const startsAtTimeSchema = z
  .string()
  .trim()
  .min(1, copy.errors.startsAtTimeRequired)
  .regex(/^\d{2}:\d{2}$/, copy.errors.startsAtInvalid);

/**
 * Empty means unlimited. Otherwise a whole number of people, at least one.
 *
 * Accepts a number as well as a string on purpose. This schema runs on both
 * sides of the wire and the two sides disagree about the type: `FormData`
 * always yields strings, but `@stackmyth/form`'s store reads an
 * `<input type="number">` as an actual number. A `z.string()` here fails
 * client-side with "expected string, received number" — which is a confusing
 * message for a field the user filled in correctly.
 */
const capacitySchema = z.union([z.string(), z.number()]).transform((raw, ctx) => {
  const value = String(raw).trim();
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
  title: z
    .string()
    .trim()
    .min(1, copy.errors.titleRequired)
    .max(TITLE_MAX, copy.errors.titleTooLong),
  kind: eventKindSchema,
  startsAtDate: startsAtDateSchema,
  startsAtTime: startsAtTimeSchema,
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
  // Join the two wall-clock parts and resolve them against Bogota's real
  // offset for that instant.
  const startsAt = fromDateTimeLocalValue(`${parsed.startsAtDate}T${parsed.startsAtTime}`);

  if (!startsAt) {
    ctx.addIssue({
      code: "custom",
      message: copy.errors.startsAtInvalid,
      path: ["startsAtDate"],
    });
    return z.NEVER;
  }

  if (parsed.costMode === "none") {
    return { ...parsed, startsAt, costAmountMinor: null as number | null };
  }

  const costAmountMinor = parseCostAmount(parsed.costAmount, parsed.currency, ctx, "costAmount");

  if (costAmountMinor === null) return z.NEVER;

  return { ...parsed, startsAt, costAmountMinor };
});

export type EventInput = z.infer<typeof eventSchema>;

/**
 * Client-side view of the same rules, for `@stackmyth/form`'s Zod resolver.
 *
 * Same field constraints, but no transforms: the resolver only needs per-field
 * messages, and `FormController` hands the raw values straight back so they can
 * be forwarded to the server action untouched.
 *
 * The server still parses with `eventSchema` on every submission — this is
 * feedback, not authority. Both are built from the same field schemas above, so
 * a rule cannot be tightened in one place and forgotten in the other.
 */
export const eventClientSchema = eventFieldsSchema.superRefine((values, ctx) => {
  if (values.costMode === "none") return;

  const cleaned = values.costAmount.replace(/[\s.,]/g, "");

  if (cleaned.length === 0) {
    ctx.addIssue({ code: "custom", message: copy.errors.costRequired, path: ["costAmount"] });
    return;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    ctx.addIssue({ code: "custom", message: copy.errors.costInvalid, path: ["costAmount"] });
  }
});

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
