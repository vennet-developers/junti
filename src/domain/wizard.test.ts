import { describe, expect, it } from "vitest";

import {
  ALL_WIZARD_FIELDS,
  STEP_FIELDS,
  WIZARD_STEPS,
  firstStepWithError,
  isLastStep,
  nextStep,
  normaliseStep,
  previousStep,
  stepOf,
} from "./wizard";

/**
 * The mapping is the part worth testing, because both ways of getting it wrong
 * are silent: a field on no step can never be filled, and a field on two steps
 * blocks the organizer on a screen that is not showing it.
 */

describe("every field has exactly one home", () => {
  it("puts no field on two steps", () => {
    expect(new Set(ALL_WIZARD_FIELDS).size).toBe(ALL_WIZARD_FIELDS.length);
  });

  /**
   * The list the server actually parses. If a field is added to the event
   * schema and not to a step, this is what says so — otherwise it silently
   * submits empty forever.
   */
  it("covers every field the create action reads", () => {
    const submitted = [
      "title",
      "eventTypeId",
      "groupId",
      "startsAtDate",
      "startsAtTime",
      "timeZone",
      "location",
      "capacity",
      "rsvpLead",
      "notes",
      "costMode",
      "costAmount",
      "currency",
      "refundNotice",
      "policies",
    ];

    expect([...ALL_WIZARD_FIELDS].sort()).toEqual([...submitted].sort());
  });

  /**
   * The money lives WITH its question, on the same step. It used to live on a
   * third step that only appeared once the cost answer was given, and that
   * design failed a real organizer twice in one pass: the step count mutated
   * under him, and the amount hid on a screen he was not expecting.
   */
  it("keeps the money fields on the same step as the cost question", () => {
    expect(STEP_FIELDS[2]).toContain("costMode");
    expect(STEP_FIELDS[2]).toContain("costAmount");
    expect(STEP_FIELDS[2]).toContain("currency");
    expect(STEP_FIELDS[2]).toContain("refundNotice");
  });

  it("knows which step a field is on", () => {
    expect(stepOf("title")).toBe(1);
    expect(stepOf("capacity")).toBe(2);
    expect(stepOf("costAmount")).toBe(2);
    expect(stepOf("inventado")).toBeNull();
  });
});

describe("where a server error sends you back to", () => {
  it("picks the earliest step carrying an error", () => {
    expect(firstStepWithError(["costAmount", "title"])).toBe(1);
    expect(firstStepWithError(["costAmount", "capacity"])).toBe(2);
    expect(firstStepWithError(["currency"])).toBe(2);
  });

  it("stays put when the error belongs to no field", () => {
    // `_form` errors — a rate limit, a lost session — are not about a field
    // and must not bounce somebody to step 1.
    expect(firstStepWithError(["_form"])).toBeNull();
    expect(firstStepWithError([])).toBeNull();
  });
});

describe("navigation", () => {
  it("is two steps, always — the count must never mutate mid-form", () => {
    expect(WIZARD_STEPS).toEqual([1, 2]);
  });

  it("clamps anything arriving from the URL", () => {
    expect(normaliseStep("2")).toBe(2);
    expect(normaliseStep(2)).toBe(2);
    // A typed URL is not a crash — and old ?step=3 links land safely.
    expect(normaliseStep("3")).toBe(1);
    expect(normaliseStep("9")).toBe(1);
    expect(normaliseStep("0")).toBe(1);
    expect(normaliseStep("dos")).toBe(1);
    expect(normaliseStep(undefined)).toBe(1);
    expect(normaliseStep(1.5)).toBe(1);
  });

  it("does not walk off either end", () => {
    expect(previousStep(1)).toBe(1);
    expect(nextStep(2)).toBe(2);
    expect(isLastStep(2)).toBe(true);
    expect(isLastStep(1)).toBe(false);
  });

  it("walks the steps in order", () => {
    expect(nextStep(1)).toBe(2);
    expect(previousStep(2)).toBe(1);
  });
});
