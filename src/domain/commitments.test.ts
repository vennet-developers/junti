import { describe, expect, it } from "vitest";

import {
  NOTE_MAX,
  REACTIONS,
  canDeleteCommitment,
  checkCommitment,
  isReaction,
  noteLength,
} from "./commitments";

describe("what counts as something to say", () => {
  it("takes a note on its own", () => {
    expect(checkCommitment({ note: "Yo llevo el balón", reaction: null })).toEqual({
      ok: true,
      value: { note: "Yo llevo el balón", reaction: null },
    });
  });

  it("takes a reaction on its own", () => {
    expect(checkCommitment({ note: null, reaction: "⚽" })).toEqual({
      ok: true,
      value: { note: null, reaction: "⚽" },
    });
  });

  it("takes both", () => {
    const result = checkCommitment({ note: "Llevo la torta", reaction: "🎂" });

    expect(result.value).toEqual({ note: "Llevo la torta", reaction: "🎂" });
  });

  it("rejects nothing at all, which is a deletion rather than a save", () => {
    expect(checkCommitment({ note: "", reaction: null }).problem).toBe("empty");
    expect(checkCommitment({ note: "   ", reaction: null }).problem).toBe("empty");
    expect(checkCommitment({ note: null, reaction: null }).problem).toBe("empty");
  });

  it("turns an emptied box into null, not into an empty line in the feed", () => {
    expect(checkCommitment({ note: "  ", reaction: "🔥" }).value).toEqual({
      note: null,
      reaction: "🔥",
    });
  });

  it("trims what was typed", () => {
    expect(checkCommitment({ note: "  llevo hielo  ", reaction: null }).value?.note).toBe(
      "llevo hielo",
    );
  });
});

describe("the length cap", () => {
  it("accepts a note exactly at the limit", () => {
    expect(checkCommitment({ note: "a".repeat(NOTE_MAX), reaction: null }).ok).toBe(true);
  });

  it("rejects one character past it", () => {
    expect(checkCommitment({ note: "a".repeat(NOTE_MAX + 1), reaction: null }).problem).toBe(
      "too-long",
    );
  });

  /**
   * The reason it counts code points: an emoji is two UTF-16 units, so
   * `.length` would let through roughly half as many visible characters as the
   * cap promises — and cut a surrogate pair in half if anything truncated.
   */
  it("counts an emoji as one character, the way a reader sees it", () => {
    // 🎂 is outside the BMP, so JavaScript stores it as two UTF-16 units.
    // (⚽ is not, which is exactly why picking the example matters.)
    expect(noteLength("🎂")).toBe(1);
    expect("🎂".length).toBe(2);

    expect(checkCommitment({ note: "🎂".repeat(NOTE_MAX), reaction: null }).ok).toBe(true);
    expect(checkCommitment({ note: "🎂".repeat(NOTE_MAX + 1), reaction: null }).ok).toBe(false);
  });
});

describe("the reaction allowlist", () => {
  it("accepts every reaction on offer", () => {
    for (const reaction of REACTIONS) {
      expect(isReaction(reaction)).toBe(true);
      expect(checkCommitment({ note: null, reaction }).ok).toBe(true);
    }
  });

  it("rejects an emoji nobody chose", () => {
    // Not offensive, just not ours: arbitrary emoji render inconsistently and
    // there is no moderation queue to catch the ones that are a problem.
    expect(checkCommitment({ note: null, reaction: "💀" }).problem).toBe("unknown-reaction");
    expect(isReaction("💀")).toBe(false);
  });

  it("rejects text smuggled in as a reaction", () => {
    expect(checkCommitment({ note: null, reaction: "<script>" }).problem).toBe("unknown-reaction");
    expect(checkCommitment({ note: "hola", reaction: "cualquier cosa" }).ok).toBe(false);
  });
});

describe("who may delete a note", () => {
  const author = "participant-a";

  it("lets the author remove their own", () => {
    expect(
      canDeleteCommitment({
        authorParticipantId: author,
        readerParticipantId: author,
        readerIsOrganizer: false,
      }),
    ).toBe(true);
  });

  it("lets the organizer remove anybody's", () => {
    expect(
      canDeleteCommitment({
        authorParticipantId: author,
        readerParticipantId: "participant-b",
        readerIsOrganizer: true,
      }),
    ).toBe(true);
  });

  it("stops one participant removing another's", () => {
    expect(
      canDeleteCommitment({
        authorParticipantId: author,
        readerParticipantId: "participant-b",
        readerIsOrganizer: false,
      }),
    ).toBe(false);
  });

  it("stops somebody who is not on the roster at all", () => {
    expect(
      canDeleteCommitment({
        authorParticipantId: author,
        readerParticipantId: null,
        readerIsOrganizer: false,
      }),
    ).toBe(false);
  });
});
