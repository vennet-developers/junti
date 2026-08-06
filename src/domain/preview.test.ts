import { describe, expect, it } from "vitest";

import {
  effectivePreviewMode,
  parsePreviewMode,
  previewModeOf,
  previewReader,
} from "./preview";

/**
 * The rules that decide whose eyes an organizer is borrowing.
 *
 * Small enough to read, and tested anyway because the failure is not visual:
 * a mask that grants instead of removing would show one person another
 * person's page, and nothing on screen would look wrong.
 */

describe("reading the mode off a URL", () => {
  it("accepts the two it offers", () => {
    expect(parsePreviewMode("guest")).toBe("guest");
    expect(parsePreviewMode("stranger")).toBe("stranger");
  });

  /**
   * A query string is edited by hand, truncated by chat apps and appended to
   * by link trackers. None of that should break the page.
   */
  it("reads anything else as no preview at all", () => {
    for (const raw of ["organizer", "GUEST", "", " guest", null, undefined, 1, ["guest"], {}]) {
      expect(parsePreviewMode(raw), `${JSON.stringify(raw)}`).toBeNull();
    }
  });
});

describe("who may use it", () => {
  it("lets the owner borrow either pair of eyes", () => {
    expect(effectivePreviewMode({ requested: "guest", isOwner: true })).toBe("guest");
    expect(effectivePreviewMode({ requested: "stranger", isOwner: true })).toBe("stranger");
  });

  /**
   * Ignored, not refused. A refusal would answer "is this event yours?" for
   * whoever pasted the link, and `?as=` on a URL is exactly the kind of thing
   * that ends up in a group chat by accident.
   */
  it("ignores it for everybody else", () => {
    expect(effectivePreviewMode({ requested: "stranger", isOwner: false })).toBeNull();
    expect(effectivePreviewMode({ requested: "guest", isOwner: false })).toBeNull();
  });

  it("is inert with nothing requested", () => {
    expect(effectivePreviewMode({ requested: null, isOwner: true })).toBeNull();
  });
});

describe("what a mode leaves the reader with", () => {
  const OWNER = { signedIn: true, ownStake: true };

  it("changes nothing when no mode is in force", () => {
    expect(previewReader(OWNER, null)).toEqual(OWNER);
  });

  it("keeps a guest signed in and takes away their own answer", () => {
    expect(previewReader(OWNER, "guest")).toEqual({ signedIn: true, ownStake: false });
  });

  it("takes the session from a stranger, which is what puts the gate back", () => {
    expect(previewReader(OWNER, "stranger")).toEqual({ signedIn: false, ownStake: false });
  });

  /**
   * The invariant the feature rests on: a mode narrows, never grants. Somebody
   * with nothing comes out of every mode with nothing, so the worst a bug in
   * here can do is show an organizer less of their own event.
   */
  it("cannot hand anybody something they did not already have", () => {
    const nobody = { signedIn: false, ownStake: false };
    for (const mode of [null, "guest", "stranger"] as const) {
      expect(previewReader(nobody, mode), `${mode}`).toEqual(nobody);
    }

    // And a signed-in reader with no stake never gains one.
    const looker = { signedIn: true, ownStake: false };
    for (const mode of [null, "guest", "stranger"] as const) {
      expect(previewReader(looker, mode).ownStake, `${mode}`).toBe(false);
    }
  });
});

describe("what the app shell can read off a loader payload", () => {
  it("finds the mode the event page recorded", () => {
    expect(previewModeOf({ preview: "stranger", title: "Tenis" })).toBe("stranger");
    expect(previewModeOf({ preview: "guest" })).toBe("guest");
  });

  /**
   * The shell is handed one payload per matched route, and most of them have
   * no `preview` key — or no payload at all while a route is still pending.
   */
  it("shrugs at every other shape", () => {
    for (const data of [null, undefined, {}, { preview: null }, "stranger", 1, []]) {
      expect(previewModeOf(data), `${JSON.stringify(data)}`).toBeNull();
    }
  });

  /**
   * The reason this reads the payload instead of the URL: a non-owner's
   * `?as=stranger` never becomes a `preview` value, so there is nothing here
   * for the shell to act on.
   */
  it("cannot be reached by a URL the server already refused", () => {
    const refused = { preview: effectivePreviewMode({ requested: "stranger", isOwner: false }) };
    expect(previewModeOf(refused)).toBeNull();
  });
});
