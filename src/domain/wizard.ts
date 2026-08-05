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
 * Step 2 — **who.** The group it invites from, the cap, and what a person has
 * to do to count as confirmed. `policies` lives here rather than with the
 * money on purpose: "Leí las indicaciones" has nothing to do with cost, and
 * putting it in the skippable step would make it unreachable for a free event.
 *
 * Step 3 — **money.** Skippable, and the only step that is.
 */
export const STEP_FIELDS = {
  1: ["title", "eventTypeId", "startsAtDate", "startsAtTime", "timeZone", "location", "notes"],
  2: ["groupId", "capacity", "policies"],
  3: ["costMode", "currency", "costAmount"],
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
 * AC-1 says it is skippable "for events with no money", and the honest reading
 * is that an event with no cost has nothing on that screen but the control
 * that says so. The control itself lives on step 3, so this is about what the
 * *advance* button says on step 2 — "Siguiente" or "Crear evento" — rather
 * than about hiding the step.
 */
export function isMoneyStepEmpty(costMode: string): boolean {
  return costMode === "none";
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
