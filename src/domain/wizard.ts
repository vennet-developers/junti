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

export const WIZARD_STEPS = [1, 2, 3] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/**
 * Step 1 — **what, when, where.** Everything that makes the event a thing on a
 * calendar. Somebody who fills only this has a complete event.
 *
 * Step 2 — **who, and whether it costs.** The group it invites from, the cap,
 * what a person has to do to count as confirmed, and the yes/no on money.
 *
 * `costMode` belongs here rather than on step 3, and the first version got it
 * wrong: the question "does this cost anything?" decides whether step 3 is
 * reached, so asking it *on* step 3 is circular. It also made the wizard claim
 * three steps to an organizer who would only ever fill two.
 *
 * `policies` is here for a related reason: "Leí las indicaciones" has nothing
 * to do with cost, and on the skippable step it would be unreachable for a
 * free event.
 *
 * Step 3 — **how much.** Only the amount and the currency, and only reached
 * when step 2 said there is a cost.
 */
export const STEP_FIELDS = {
  1: ["title", "eventTypeId", "startsAtDate", "startsAtTime", "timeZone", "location", "notes"],
  2: ["groupId", "capacity", "policies", "costMode"],
  3: ["currency", "costAmount"],
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

/**
 * Whether step 3 has anything to ask.
 *
 * With `costMode` on step 2, this is knowable before the organizer gets there,
 * which is what lets the wizard be honest about its own length: a free event
 * is a two-step wizard and says so, rather than promising a third screen it
 * will never show.
 */
export function isMoneyStepEmpty(costMode: string): boolean {
  return costMode === "none";
}

/**
 * How many steps this event actually has.
 *
 * The progress indicator's denominator. "Paso 1 de 3" on a form somebody will
 * finish in two is a small lie that gets noticed — it reads as a step that
 * went missing.
 */
export function totalSteps(costMode: string): number {
  return isMoneyStepEmpty(costMode) ? 2 : WIZARD_STEPS.length;
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
