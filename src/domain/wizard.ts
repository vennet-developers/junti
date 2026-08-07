/**
 * Which field belongs to which step, and when a step may be left.
 *
 * Pure and separate from the form because this is the part that has to be
 * right and the part a component test would never reach: a field that belongs
 * to no step is a field the organizer can never fill, and a field in two steps
 * is one that validates twice and blocks on the wrong screen.
 *
 * The card's guidance says per-step and final validation must derive from a
 * single schema so they cannot drift. This module is the other half of that:
 * `makeStepSchema` in `validation.ts` picks these exact names out of the one
 * schema the server also uses.
 */

export const WIZARD_STEPS = [1, 2] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Step 1 — **what, when, where.** Everything that makes the event a thing on a
 * calendar. Somebody who fills only this has a complete event.
 *
 * Step 2 — **who, and the money.** The group it invites from, the cap, by
 * when they have to answer, what a person has to do to count as confirmed,
 * the yes/no on cost — and, when the answer is yes, the money fields RIGHT
 * THERE, unfolding under the question.
 *
 * `rsvpLead` is here and not on step 1 even though it is made of the start
 * time: the organizer is answering "who is coming and by when do I need to
 * know", not "when is it". Step 1 stays the screen somebody can fill and stop.
 *
 * There used to be a step 3 holding the money fields, reached only when step
 * 2 said there was a cost — and Ivan hit exactly the two ways that design
 * fails. The step count MUTATED under him (the wizard promised two steps,
 * then answering "sí tiene costo" grew a third), and the amount lived on a
 * screen he was not expecting, so he finished "the last step" and could not
 * find where the price went. Progressive disclosure in place kills both: the
 * count never changes, and the fields appear where the question was asked.
 */
export const STEP_FIELDS = {
  1: ["title", "eventTypeId", "startsAtDate", "startsAtTime", "timeZone", "location", "notes"],
  2: [
    "groupId",
    "capacity",
    "rsvpLead",
    "policies",
    "costMode",
    "currency",
    "costAmount",
    "refundNotice",
  ],
} as const satisfies Record<WizardStep, readonly string[]>;

/** Every field the wizard knows about, flattened. Used to prove the mapping. */
export const ALL_WIZARD_FIELDS = Object.values(STEP_FIELDS).flat();

/**
 * Which step a field is on, for putting a server error back where it belongs.
 *
 * The server re-validates everything and can reject a field the client thought
 * was fine — a group that stopped existing between steps, a currency that is
 * no longer supported. Landing on step 3 with an error about the title is how
 * a form becomes unusable, so the submit handler walks the organizer back.
 */
export function stepOf(field: string): WizardStep | null {
  for (const step of WIZARD_STEPS) {
    if ((STEP_FIELDS[step] as readonly string[]).includes(field)) return step;
  }
  return null;
}

/** The earliest step carrying one of these errors. Where to send somebody back to. */
export function firstStepWithError(fields: readonly string[]): WizardStep | null {
  const steps = fields.map(stepOf).filter((s): s is WizardStep => s !== null);
  return steps.length === 0 ? null : (Math.min(...steps) as WizardStep);
}

/** Clamps anything arriving from a URL. `?step=9` is a typo, not a crash. */
export function normaliseStep(raw: unknown): WizardStep {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > WIZARD_STEPS.length) return 1;
  return n as WizardStep;
}

export function isLastStep(step: WizardStep): boolean {
  return step === WIZARD_STEPS[WIZARD_STEPS.length - 1];
}

export function nextStep(step: WizardStep): WizardStep {
  return isLastStep(step) ? step : ((step + 1) as WizardStep);
}

export function previousStep(step: WizardStep): WizardStep {
  return step === 1 ? 1 : ((step - 1) as WizardStep);
}
