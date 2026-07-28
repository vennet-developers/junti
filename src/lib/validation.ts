import { z } from "zod";

import type { Copy } from "@/config/copy";
import { LOCALES } from "@/config/copy";

import { DEFAULT_TIME_ZONE, fromDateTimeLocalValue, toMinorUnits } from "./format";
import { isValidTimeZone } from "./time-zones";

/**
 * Zod schemas for every input boundary.
 *
 * Everything arriving from a form is a string, so these schemas do the parsing
 * as well as the validating — a route or action never sees a raw FormData
 * value.
 *
 * Every schema is a **factory taking `Copy`** rather than a module-level
 * constant. That is entirely because of languages: a schema built once at
 * import time would bake in whichever language happened to be compiled first
 * and hand a Spanish validation error to someone reading the English page.
 * Building per request costs a few microseconds and cannot get that wrong.
 */

const TITLE_MAX = 120;
const NAME_MAX = 40;
const NOTES_MAX = 2000;
const LOCATION_MAX = 200;
const POLICY_LABEL_MAX = 60;
const POLICY_DESCRIPTION_MAX = 400;
const POLICY_NOTE_MAX = 200;

/** Five is already more hoops than anyone will jump through for five-a-side. */
export const MAX_POLICIES_PER_EVENT = 5;

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
export const policyKindSchema = z.enum(["proof_of_payment", "acknowledgement"]);
export const policyReviewSchema = z.enum(["approved", "rejected"]);
export const localeSchema = z.enum(LOCALES).catch("es");

export const participantIdSchema = z.uuid();
export const policyIdSchema = z.uuid();
export const submissionIdSchema = z.uuid();

/**
 * Any identifier this runtime recognises, not a list of the ones we offer.
 * Rejecting a real place because it is not in the picker would be a bug.
 */
const timeZoneSchema = (copy: Copy) =>
  z
    .string()
    .trim()
    .default(DEFAULT_TIME_ZONE)
    .refine((value) => isValidTimeZone(value), { message: copy.errors.timeZoneInvalid });

/** What a participant may choose. `waitlisted` is assigned by the server, never requested. */
export const rsvpAttendanceSchema = (copy: Copy) =>
  z.enum(["in", "out", "maybe"], { message: copy.errors.attendanceInvalid });

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3)
  .regex(/^[A-Z]{3}$/)
  .default("COP");

/**
 * Wall-clock date and time, submitted separately by the Stackmyth pickers and
 * interpreted together in the event's own timezone.
 *
 * Kept as two fields rather than one `datetime-local` string because `Calendar`
 * and `TimePicker` are separate components. Neither part carries a timezone on
 * the wire; the transform below resolves the real offset for that instant.
 */
const startsAtDateSchema = (copy: Copy) =>
  z
    .string()
    .trim()
    .min(1, copy.errors.startsAtRequired)
    .regex(/^\d{4}-\d{2}-\d{2}$/, copy.errors.startsAtInvalid);

const startsAtTimeSchema = (copy: Copy) =>
  z
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
const capacitySchema = (copy: Copy) =>
  z.union([z.string(), z.number()]).transform((raw, ctx) => {
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
  copy: Copy,
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
const eventFieldsSchema = (copy: Copy) =>
  z.object({
    title: z
      .string()
      .trim()
      .min(1, copy.errors.titleRequired)
      .max(TITLE_MAX, copy.errors.titleTooLong),
    kind: eventKindSchema,
    startsAtDate: startsAtDateSchema(copy),
    startsAtTime: startsAtTimeSchema(copy),
    timeZone: timeZoneSchema(copy),
    locale: localeSchema,
    location: optionalText(LOCATION_MAX),
    capacity: capacitySchema(copy),
    notes: optionalText(NOTES_MAX),
    costMode: costModeSchema,
    costAmount: costAmountSchema,
    currency: currencySchema,

    /**
     * The policy list, as the JSON string `PolicyEditor` writes into the store.
     *
     * Declared here even though the server re-reads it straight from FormData,
     * and that is not redundant: Zod strips keys its schema does not know
     * about, so a field missing from this object is silently dropped by the
     * client resolver and never reaches the action at all. It is validated
     * properly by `parsePoliciesField`; this only has to keep it alive.
     */
    policies: z.string().default("[]"),
  });

/**
 * Resolves the amount against the cost mode: required when there is a cost,
 * discarded when there isn't. Applied after the object parses so both fields
 * are available.
 *
 * Create and edit share this schema — the fields are identical, and letting
 * them drift would be how the edit form quietly stops validating something.
 */
export const makeEventSchema = (copy: Copy) =>
  eventFieldsSchema(copy).transform((parsed, ctx) => {
    // Join the two wall-clock parts and resolve them against the event's own
    // zone, which is one of the fields being submitted.
    const startsAt = fromDateTimeLocalValue(
      `${parsed.startsAtDate}T${parsed.startsAtTime}`,
      parsed.timeZone,
    );

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

    const costAmountMinor = parseCostAmount(
      parsed.costAmount,
      parsed.currency,
      ctx,
      "costAmount",
      copy,
    );

    if (costAmountMinor === null) return z.NEVER;

    return { ...parsed, startsAt, costAmountMinor };
  });

export type EventInput = z.infer<ReturnType<typeof makeEventSchema>>;

/**
 * Client-side view of the same rules, for `@stackmyth/form`'s Zod resolver.
 *
 * Same field constraints, but no transforms: the resolver only needs per-field
 * messages, and `FormController` hands the raw values straight back so they can
 * be forwarded to the server action untouched.
 *
 * The server still parses with `makeEventSchema` on every submission — this is
 * feedback, not authority. Both are built from the same field schemas above, so
 * a rule cannot be tightened in one place and forgotten in the other.
 */
export const makeEventClientSchema = (copy: Copy) =>
  eventFieldsSchema(copy).superRefine((values, ctx) => {
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

const displayNameSchema = (copy: Copy) =>
  z.string().trim().min(1, copy.errors.nameRequired).max(NAME_MAX, copy.errors.nameTooLong);

export const makeRsvpSchema = (copy: Copy) =>
  z.object({
    displayName: displayNameSchema(copy),
    attendance: rsvpAttendanceSchema(copy),
  });

export type RsvpInput = z.infer<ReturnType<typeof makeRsvpSchema>>;

export const makeAddParticipantSchema = (copy: Copy) =>
  z.object({
    displayName: displayNameSchema(copy),
    attendance: rsvpAttendanceSchema(copy),
  });

export const setPaymentStatusSchema = z.object({
  participantId: participantIdSchema,
  status: paymentStatusSchema,
  method: optionalText(60),
});

// ── Policies ─────────────────────────────────────────────────────────────────

/**
 * One policy as the organizer's form describes it.
 *
 * `label` is free text and stays free text: it is what participants read, in
 * whatever words and language the organizer chose, and nothing translates it.
 */
export const makePolicyInputSchema = (copy: Copy) =>
  z.object({
    /**
     * Present when the row already exists, absent when it was just added.
     *
     * This is what lets editing tell "renamed" from "replaced": an id that
     * comes back gets updated in place and keeps its submissions, while one
     * that does not come back is deleted, taking its submissions with it.
     */
    id: z.uuid().optional(),
    kind: policyKindSchema,
    label: z
      .string()
      .trim()
      .min(1, copy.errors.policyLabelRequired)
      .max(POLICY_LABEL_MAX, copy.errors.policyLabelTooLong),
    description: optionalText(POLICY_DESCRIPTION_MAX),
  });

export type PolicyInput = z.infer<ReturnType<typeof makePolicyInputSchema>>;

export const makePoliciesInputSchema = (copy: Copy) =>
  z
    .array(makePolicyInputSchema(copy))
    .max(MAX_POLICIES_PER_EVENT, copy.errors.policyTooMany(MAX_POLICIES_PER_EVENT));

/**
 * The policy list travels as one JSON field rather than as `policy[0][label]`
 * style names.
 *
 * Rows are added and removed on the client, so indexed field names would leave
 * holes in the sequence the moment someone deletes the middle one, and every
 * reader of the FormData would have to agree on how to close them.
 */
export function parsePoliciesField(
  raw: string,
  copy: Copy,
): { ok: true; value: PolicyInput[] } | { ok: false; message: string } {
  if (raw.trim().length === 0) return { ok: true, value: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: copy.common.unknownError };
  }

  const result = makePoliciesInputSchema(copy).safeParse(parsed);

  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? copy.common.unknownError };
  }

  return { ok: true, value: result.data };
}

export const makeSubmissionNoteSchema = () => optionalText(POLICY_NOTE_MAX);

export const reviewSubmissionSchema = z.object({
  submissionId: submissionIdSchema,
  decision: policyReviewSchema,
  reviewNote: optionalText(POLICY_NOTE_MAX),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

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
