import { describe, expect, it } from "vitest";

import { isAlreadyJoined, isNameTaken } from "./db-errors";

/**
 * The double-tap guarantee, at the only layer where it can be tested without a
 * database.
 *
 * Tapping "I'm in" twice on a slow connection races two inserts past the read
 * that would have caught the duplicate, and the unique index rejects the
 * second. Whether that reads as "you're on the list" or as "that name is
 * taken" comes down entirely to which constraint name is in the error — and
 * getting it wrong sends somebody who is already going to a form to rename
 * themselves.
 */

/** What `postgres` actually throws: a structured error carrying the name. */
function driverError(constraint: string) {
  return Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code: "23505",
    constraint_name: constraint,
  });
}

/** The same failure after Drizzle has wrapped it — name only in the text. */
function wrappedError(constraint: string) {
  return Object.assign(new Error("Failed query: insert into participants ..."), {
    cause: new Error(`duplicate key value violates unique constraint "${constraint}"`),
  });
}

describe("the same account joining twice", () => {
  it("reads as already joined, not as a name collision", () => {
    const error = driverError("participants_event_user_unique");

    expect(isAlreadyJoined(error)).toBe(true);
    expect(isNameTaken(error)).toBe(false);
  });

  it("survives being wrapped, so a double tap never becomes a rename prompt", () => {
    const error = wrappedError("participants_event_user_unique");

    expect(isAlreadyJoined(error)).toBe(true);
    expect(isNameTaken(error)).toBe(false);
  });
});

describe("two people with the same name", () => {
  it("reads as a name collision, not as already joined", () => {
    const error = driverError("participants_event_name_unique");

    expect(isNameTaken(error)).toBe(true);
    expect(isAlreadyJoined(error)).toBe(false);
  });

  it("is still a collision once wrapped", () => {
    expect(isNameTaken(wrappedError("participants_event_name_unique"))).toBe(true);
  });
});

describe("anything else", () => {
  it("is neither, so an unrelated failure is not swallowed as success", () => {
    // The dangerous direction: reporting success for a row that was never
    // written would leave somebody believing they are on a list they are not.
    for (const error of [
      new Error("connection terminated unexpectedly"),
      driverError("payments_participant_unique"),
      "a string",
      null,
      undefined,
    ]) {
      expect(isAlreadyJoined(error)).toBe(false);
      expect(isNameTaken(error)).toBe(false);
    }
  });
});
