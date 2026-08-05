import { describe, expect, it } from "vitest";

import {
  ALL_WIZARD_FIELDS,
  STEP_FIELDS,
  WIZARD_STEPS,
  firstStepWithError,
  isLastStep,
  isMoneyStepEmpty,
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
      "notes",
      "costMode",
      "costAmount",
      "currency",
      "policies",
    ];

    expect([...ALL_WIZARD_FIELDS].sort()).toEqual([...submitted].sort());
  });

  it("keeps the confirmation requirements out of the skippable step", () => {
    // `policies` includes "Leí las indicaciones", which has nothing to do with
    // money. On step 3 it would be unreachable for a free event.
    expect(STEP_FIELDS[2]).toContain("policies");
    expect(STEP_FIELDS[3]).not.toContain("policies");
  });

  it("knows which step a field is on", () => {
    expect(stepOf("title")).toBe(1);
    expect(stepOf("capacity")).toBe(2);
    expect(stepOf("costAmount")).toBe(3);
    expect(stepOf("inventado")).toBeNull();
  });
});

describe("where a server error sends you back to", () => {
  it("picks the earliest step carrying an error", () => {
    expect(firstStepWithError(["costAmount", "title"])).toBe(1);
    expect(firstStepWithError(["costAmount", "capacity"])).toBe(2);
    expect(firstStepWithError(["currency"])).toBe(3);
  });

  it("stays put when the error belongs to no field", () => {
    // `_form` errors — a rate limit, a lost session — are not about a field
    // and must not bounce somebody to step 1.
    expect(firstStepWithError(["_form"])).toBeNull();
    expect(firstStepWithError([])).toBeNull();
  });
});

describe("navigation", () => {
  it("clamps anything arriving from the URL", () => {
    expect(normaliseStep("2")).toBe(2);
    expect(normaliseStep(2)).toBe(2);
    // A typed URL is not a crash.
    expect(normaliseStep("9")).toBe(1);
    expect(normaliseStep("0")).toBe(1);
    expect(normaliseStep("dos")).toBe(1);
    expect(normaliseStep(undefined)).toBe(1);
    expect(normaliseStep(1.5)).toBe(1);
  });

  it("does not walk off either end", () => {
    expect(previousStep(1)).toBe(1);
    expect(nextStep(3)).toBe(3);
    expect(isLastStep(3)).toBe(true);
    expect(isLastStep(1)).toBe(false);
  });

  it("walks the steps in order", () => {
    expect(WIZARD_STEPS).toEqual([1, 2, 3]);
    expect(nextStep(1)).toBe(2);
    expect(previousStep(3)).toBe(2);
  });
});

describe("the money step", () => {
  it("has nothing to ask when the event is free", () => {
    expect(isMoneyStepEmpty("none")).toBe(true);
    expect(isMoneyStepEmpty("total")).toBe(false);
    expect(isMoneyStepEmpty("per_person")).toBe(false);
  });
});
