import { describe, expect, it } from "vitest";

import { sandboxSubject } from "./sandbox";

/**
 * The failure that matters here is a false negative: test mail that looks
 * exactly like the real thing, sitting in an inbox next to it. A false
 * positive — `[sandbox]` on a production message — is embarrassing and
 * obvious, which is a much cheaper way to be wrong.
 */
describe("sandboxSubject", () => {
  it("marks a sandbox message", () => {
    expect(sandboxSubject("Tu link para entrar a Junti", true)).toBe(
      "[sandbox] Tu link para entrar a Junti",
    );
  });

  it("leaves production alone", () => {
    expect(sandboxSubject("Tu link para entrar a Junti", false)).toBe(
      "Tu link para entrar a Junti",
    );
  });

  // `sandbox` is optional on the message, so undefined reaches here whenever a
  // caller built one by hand. It must not mark, because the default is applied
  // upstream in sendMessage and a second guess here would double up.
  it("leaves an unset flag alone", () => {
    expect(sandboxSubject("Confirma tu correo", undefined)).toBe("Confirma tu correo");
  });

  // Retries, resends and any future queue can hand the same subject back.
  it("does not stack on a subject that already carries the mark", () => {
    expect(sandboxSubject("[sandbox] Confirma tu correo", true)).toBe(
      "[sandbox] Confirma tu correo",
    );
  });

  it("prefixes rather than suffixes, so a truncated subject still shows it", () => {
    const long = "Ana te invitó a ".padEnd(120, "x");
    expect(sandboxSubject(long, true).startsWith("[sandbox] ")).toBe(true);
  });
});
