import { z } from "zod";

import type { Copy } from "@/config/copy";
import { LOCALES } from "@/config/copy";
import { deadlineFromLead, deadlineProblem, isLeadHours } from "@/domain/convocation";

import {
  DEFAULT_TIME_ZONE,
  fromDateTimeLocalValue,
  isSupportedCurrency,
  minorUnitExponent,
  toMinorUnits,
} from "./format";
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

export const costModeSchema = z.enum(["none", "total", "per_person"]);
export const paymentStatusSchema = z.enum(["pending", "confirmed", "waived"]);
export const policyReviewSchema = z.enum(["approved", "rejected"]);
export const localeSchema = z.enum(LOCALES).catch("es");

export const participantIdSchema = z.uuid();
export const eventIdSchema = z.uuid();
export const policyIdSchema = z.uuid();
export const eventTypeIdSchema = z.uuid();
export const policyDefinitionIdSchema = z.uuid();
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

/**
 * One of the currencies the app knows how to read and write.
 *
 * Was any three uppercase letters, which quietly meant "any currency, parsed
 * as though it were pesos". The amount parser below needs to know how many
 * decimals a code carries; a code nobody vetted is a code whose decimals are a
 * guess. See `SUPPORTED_CURRENCIES`.
 */
const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3)
  .refine(isSupportedCurrency)
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
 * How long before kick-off the call to confirm closes, or empty for no deadline.
 *
 * Silently falls back to "no deadline" rather than raising when the value is
 * not one of the offered leads. There is no way for a person filling the form
 * to produce that — it is a `<select>` over a closed list — so the only sender
 * is something that built the request by hand, and the safe reading of a
 * malformed deadline is the one that keeps answering open. An error here would
 * only ever be shown to somebody who was not going to read it.
 *
 * Accepts a number as well as a string for the same reason `capacity` does:
 * FormData yields strings, the client store may not.
 */
const rsvpLeadSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((raw) => {
    const value = Number(String(raw ?? "").trim());
    return isLeadHours(value) ? value : null;
  });

/**
 * The money amount, entered in major units (pesos) and stored in minor units.
 *
 * Accepts the separators a Colombian would actually type — `50.000`, `50 000`,
 * `50,000` — because rejecting them would be pedantic and the intent is never
 * ambiguous for a whole-peso currency.
 */
const costAmountSchema = z.string().trim();

/**
 * The largest amount an event may cost, in major units.
 *
 * Money is stored as `bigint({ mode: "number" })`, which is a JavaScript number
 * and therefore exact only below 2^53. A cap far under that means a typo can
 * never reach the precision cliff, where amounts would start rounding silently
 * on their way to Postgres. A trillion pesos is roughly a thousand times
 * Colombia's GDP; nobody is splitting that with four friends.
 */
const COST_MAX_MAJOR = 1e12;

/**
 * Turns what somebody typed into a plain decimal string, or null if it is not
 * a number at all.
 *
 * The separator problem: `1.500` is fifteen hundred to a Colombian and one and
 * a half to an American, and both are typing into the same box. The rule that
 * settles it uses the currency, which is the only party that actually knows:
 *
 * - **Zero-decimal currency (COP, CLP, …)** — every `.` and `,` is a thousands
 *   separator, because the currency has no decimals to separate. `1.500` is
 *   fifteen hundred, always.
 * - **Two-decimal currency (USD, EUR, …)** — a trailing separator followed by
 *   one or two digits is the decimal point; anything else groups thousands. So
 *   `50.50` and `50,50` are both fifty and a half, `1.234,56` and `1,234.56`
 *   are both a thousand two hundred thirty four and a half, and `1.500` — three
 *   digits, so not a decimal fraction — stays fifteen hundred.
 *
 * Before this, the separators were stripped unconditionally for every currency.
 * `50.50` in dollars became `5050`, which `toMinorUnits` then multiplied by a
 * hundred: a bill for $5.050,00 where fifty dollars and fifty cents was meant.
 * The UI pins the currency to COP today, which is the only reason nobody was
 * ever billed that way — the server action accepted whatever it was sent.
 *
 * Exported for direct testing, like `evenShares`: this is the other place where
 * being subtly wrong costs somebody real money.
 */
export function toDecimalString(raw: string, exponent: number): string {
  const compact = raw.replace(/\s/g, "");
  if (exponent === 0) return compact.replace(/[.,]/g, "");

  const decimal = new RegExp(`^(.*)[.,](\\d{1,${exponent}})$`).exec(compact);
  if (!decimal) return compact.replace(/[.,]/g, "");

  const [, whole, fraction] = decimal;
  return `${whole.replace(/[.,]/g, "")}.${fraction}`;
}

function parseCostAmount(
  raw: string,
  currency: string,
  ctx: z.RefinementCtx,
  path: string,
  copy: Copy,
): number | null {
  const cleaned = toDecimalString(raw, minorUnitExponent(currency));

  if (cleaned.length === 0) {
    ctx.addIssue({ code: "custom", message: copy.errors.costRequired, path: [path] });
    return null;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > COST_MAX_MAJOR) {
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
    eventTypeId: eventTypeIdSchema,

    /**
     * The group this event invites from, if any.
     *
     * Empty string rather than absent when the select sits on "no group" —
     * that is what a `<select>` submits — and normalised to null here so the
     * column never holds `""`. Ownership is NOT checked here: a pure schema
     * cannot ask the database whose group this is, and the action does it.
     */
    groupId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((value) => (value ? value : null)),

    startsAtDate: startsAtDateSchema(copy),
    startsAtTime: startsAtTimeSchema(copy),
    timeZone: timeZoneSchema(copy),
    locale: localeSchema,
    location: optionalText(LOCATION_MAX),
    capacity: capacitySchema(copy),
    rsvpLead: rsvpLeadSchema,
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

    // Resolved here rather than stored as a lead, because the guards and the
    // countdown need an instant. Doing it inside the transform means it is
    // recomputed against whatever start time is being saved, which is what
    // carries the deadline along when an organizer moves the event.
    const rsvpDeadline =
      parsed.rsvpLead === null ? null : deadlineFromLead(startsAt, parsed.rsvpLead);

    if (rsvpDeadline !== null) {
      const problem = deadlineProblem(rsvpDeadline, startsAt, new Date());
      if (problem !== null) {
        ctx.addIssue({
          code: "custom",
          // `after_start` is unreachable from the form — every lead is positive
          // hours before kick-off — but the rule belongs to the deadline, not
          // to the widget that happens to be producing it today.
          message:
            problem === "past" ? copy.errors.deadlineInPast : copy.errors.deadlineAfterStart,
          path: ["rsvpLead"],
        });
        return z.NEVER;
      }
    }

    if (parsed.costMode === "none") {
      return { ...parsed, startsAt, rsvpDeadline, costAmountMinor: null as number | null };
    }

    const costAmountMinor = parseCostAmount(
      parsed.costAmount,
      parsed.currency,
      ctx,
      "costAmount",
      copy,
    );

    if (costAmountMinor === null) return z.NEVER;

    return { ...parsed, startsAt, rsvpDeadline, costAmountMinor };
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

/**
 * One step's fields, picked out of the schema the server also parses.
 *
 * The card's guidance is explicit: per-step and final validation must derive
 * from a single schema so they cannot drift. This is that derivation — a
 * `.pick()` over `eventFieldsSchema`, the same object `makeEventSchema` wraps.
 * Adding a rule to a field applies it on the step and on submit, and there is
 * no second place to forget.
 *
 * Step 3 carries the cost cross-check as well, because "an amount is required
 * when there is a cost" is a rule *between* two fields on that step and would
 * otherwise only fire at the end — on a screen the organizer has left.
 */
export function makeStepSchema(copy: Copy, fields: readonly string[]) {
  const mask = Object.fromEntries(fields.map((f) => [f, true as const]));
  const picked = eventFieldsSchema(copy).pick(mask as never);

  if (!fields.includes("costAmount")) return picked;

  return picked.superRefine((values: Record<string, unknown>, ctx: z.RefinementCtx) => {
    if (values.costMode === "none") return;

    const cleaned = String(values.costAmount ?? "").replace(/[\s.,]/g, "");

    if (cleaned.length === 0) {
      ctx.addIssue({ code: "custom", message: copy.errors.costRequired, path: ["costAmount"] });
      return;
    }

    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) {
      ctx.addIssue({ code: "custom", message: copy.errors.costInvalid, path: ["costAmount"] });
    }
  });
}

const displayNameSchema = (copy: Copy) =>
  z.string().trim().min(1, copy.errors.nameRequired).max(NAME_MAX, copy.errors.nameTooLong);

export const makeRsvpSchema = (copy: Copy) =>
  z.object({
    displayName: displayNameSchema(copy),
    attendance: rsvpAttendanceSchema(copy),
  });

export type RsvpInput = z.infer<ReturnType<typeof makeRsvpSchema>>;

/**
 * How many people one send may reach.
 *
 * A ceiling on the blast radius of a single click, not on how many people an
 * event can have — invite the rest on the next click. Groups already bound this
 * from the other side (nobody is here who did not join), so this is now the
 * milder guard of the two: it stops a fifty-person group from becoming fifty
 * emails at once by accident.
 *
 * The **default**. The live value comes from `app_settings` and is passed in
 * by the caller, because this module is imported by client code and settings
 * are server-only. See `src/lib/settings.ts`.
 */
export const MAX_INVITES_PER_SEND = 20;

/**
 * A selection of group members.
 *
 * This replaced a textarea of pasted addresses, and the change is not
 * cosmetic: an organizer no longer *names* who gets email, they pick from
 * people who already agreed to hear from them. So there is nothing to parse
 * and no address to validate — only ids to check the shape of, before the
 * caller checks the thing that actually matters, which is whether each one
 * belongs to this event's group with a `joined` membership.
 */
export const makeInviteSchema = (copy: Copy, maxPerSend: number = MAX_INVITES_PER_SEND) =>
  z
    .array(z.uuid())
    .transform((ids) => [...new Set(ids)])
    .superRefine((ids, ctx) => {
      if (ids.length === 0) {
        ctx.addIssue({ code: "custom", message: copy.invites.errorEmpty });
        return;
      }

      if (ids.length > maxPerSend) {
        ctx.addIssue({
          code: "custom",
          message: copy.invites.errorTooMany(maxPerSend, ids.length),
        });
      }
    });

/**
 * The onboarding screen: who you are, and optionally how to reach you.
 *
 * The phone is stripped of everything a human puts in a number for readability
 * — spaces, dots, dashes, brackets — and then only checked for length. It is
 * deliberately NOT parsed into a canonical international form: this app never
 * dials it, a Colombian number written without +57 is perfectly usable by the
 * organizer who asked for it, and rejecting a real number for missing a country
 * code helps nobody. The same reasoning as the sign-in form's email check.
 */
export const makeProfileSchema = (copy: Copy) =>
  z.object({
    fullName: z
      .string()
      .trim()
      .min(1, copy.onboarding.errorNameRequired)
      .max(NAME_MAX * 2, copy.onboarding.errorNameTooLong),
    phone: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s().-]/g, ""))
      .refine(
        (value) => value.length === 0 || /^\+?\d{7,15}$/.test(value),
        copy.onboarding.errorPhone,
      )
      .transform((value) => (value.length === 0 ? null : value)),
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
 * Carries a reference to the catalogue plus, optionally, wording that overrides
 * it. Free text either way: whatever a human typed is shown verbatim and never
 * translated.
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

    /** Which catalogue entry this is an instance of. */
    definitionId: policyDefinitionIdSchema,

    /**
     * The organizer's wording, or empty to follow the catalogue.
     *
     * Empty is meaningful here and is not the same as absent: it stores NULL,
     * which means "whatever the definition says, in whatever language the
     * reader is using". A non-empty value is text a human typed.
     *
     * There is no "required" rule any more — an empty box is a valid answer —
     * so only the length is enforced.
     */
    label: z
      .string()
      .trim()
      .max(POLICY_LABEL_MAX, copy.errors.policyLabelTooLong)
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .catch(null),
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

/**
 * Flattens Zod issues into `{ fieldName: message }` for rendering next to inputs.
 *
 * `fallbackField` is for schemas that are not objects — a bare string one, say,
 * whose issues carry an empty path. Without it every message from such a schema
 * lands in `_form` and is rendered at the top of the form rather than under the
 * one input it is actually about.
 */
export function fieldErrors(error: z.ZodError, fallbackField = "_form"): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    const name = typeof key === "string" ? key : fallbackField;
    result[name] ??= issue.message;
  }

  return result;
}
