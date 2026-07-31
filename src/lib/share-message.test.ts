import { describe, expect, it } from "vitest";

import { SHARE_MESSAGE_MAX_LENGTH, renderShareMessage, shareMessageProblem } from "./share-message";

const VALUES = {
  title: "Fútbol de los jueves",
  when: "jue, 7 ago, 8:00 p. m.",
  link: "https://junti.app/e/abc123",
};

describe("shareMessageProblem", () => {
  it("accepts a template that carries the link", () => {
    expect(shareMessageProblem("¡Parcero! {title} — {when}. Confirma acá: {link}")).toBeNull();
  });

  it("rejects a template with no link, which is the failure that matters", () => {
    expect(shareMessageProblem("¡Parcero! {title} el {when}.")).toBe("missing-link");
  });

  it("rejects an empty template rather than saving a blank invitation", () => {
    expect(shareMessageProblem("   ")).toBe("empty");
  });

  it("rejects a template past the length cap", () => {
    const long = `${"a".repeat(SHARE_MESSAGE_MAX_LENGTH)} {link}`;
    expect(shareMessageProblem(long)).toBe("too-long");
  });

  it("measures the trimmed template, so trailing whitespace is not a length error", () => {
    const padded = `  ${"a".repeat(SHARE_MESSAGE_MAX_LENGTH - 7)} {link}  `;
    expect(shareMessageProblem(padded)).toBeNull();
  });
});

describe("renderShareMessage", () => {
  it("fills every placeholder", () => {
    expect(renderShareMessage("{title} — {when}: {link}", VALUES)).toBe(
      "Fútbol de los jueves — jue, 7 ago, 8:00 p. m.: https://junti.app/e/abc123",
    );
  });

  it("fills a placeholder used more than once", () => {
    expect(renderShareMessage("{link} … {link}", VALUES)).toBe(
      "https://junti.app/e/abc123 … https://junti.app/e/abc123",
    );
  });

  it("leaves an unknown placeholder alone, so a typo is visible in the preview", () => {
    expect(renderShareMessage("{titel} va a {link}", VALUES)).toBe(
      "{titel} va a https://junti.app/e/abc123",
    );
  });

  it("does not treat the values as templates themselves", () => {
    const injected = renderShareMessage("{title}", { ...VALUES, title: "{link}" });
    expect(injected).toBe("{link}");
  });
});
