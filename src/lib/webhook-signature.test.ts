import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyWebhook } from "./webhook-signature";

/**
 * The one piece of this app where a bug is not a broken feature but an open
 * relay: anybody who can forge a request to the send-email hook can make Junti
 * email an arbitrary address with an arbitrary link in it. So these test the
 * ways verification could wrongly succeed, not just that the happy path works.
 */

const SECRET = "v1,whsec_c2VjcmV0LWtleS1mb3ItdGVzdGluZy1vbmx5";
const NOW = 1_700_000_000;

function sign(body: string, id: string, timestamp: number, secret = SECRET): string {
  const base64 = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  const mac = createHmac("sha256", Buffer.from(base64, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${mac}`;
}

const BODY = JSON.stringify({ user: { email: "a@b.co" }, email_data: { token_hash: "abc" } });

function headers(overrides: Partial<Record<"id" | "timestamp" | "signature", string>> = {}) {
  return {
    id: "msg_1",
    timestamp: String(NOW),
    signature: sign(BODY, "msg_1", NOW),
    ...overrides,
  };
}

describe("verifyWebhook", () => {
  it("accepts a correctly signed payload", () => {
    expect(verifyWebhook(BODY, headers(), SECRET, NOW)).toBe(true);
  });

  it("accepts when one of several rotated signatures matches", () => {
    const signature = `v1,AAAA ${sign(BODY, "msg_1", NOW)}`;
    expect(verifyWebhook(BODY, headers({ signature }), SECRET, NOW)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = BODY.replace("a@b.co", "attacker@evil.co");
    expect(verifyWebhook(tampered, headers(), SECRET, NOW)).toBe(false);
  });

  it("rejects a signature made with another secret", () => {
    const signature = sign(BODY, "msg_1", NOW, "v1,whsec_YW5vdGhlci1zZWNyZXQta2V5LWhlcmU=");
    expect(verifyWebhook(BODY, headers({ signature }), SECRET, NOW)).toBe(false);
  });

  it("rejects when the id is not the one that was signed", () => {
    expect(verifyWebhook(BODY, headers({ id: "msg_2" }), SECRET, NOW)).toBe(false);
  });

  // Replay protection. The signature stays valid forever; the timestamp is what
  // stops a captured request from being useful tomorrow.
  it("rejects a payload older than the tolerance", () => {
    const old = NOW - 6 * 60;
    const stale = { id: "msg_1", timestamp: String(old), signature: sign(BODY, "msg_1", old) };
    expect(verifyWebhook(BODY, stale, SECRET, NOW)).toBe(false);
  });

  it("rejects a payload from too far in the future", () => {
    const ahead = NOW + 6 * 60;
    const early = { id: "msg_1", timestamp: String(ahead), signature: sign(BODY, "msg_1", ahead) };
    expect(verifyWebhook(BODY, early, SECRET, NOW)).toBe(false);
  });

  it("rejects missing headers rather than throwing", () => {
    expect(verifyWebhook(BODY, { id: null, timestamp: null, signature: null }, SECRET, NOW)).toBe(
      false,
    );
  });

  it("rejects a non-numeric timestamp", () => {
    const bad = headers({ timestamp: "not-a-number" });
    expect(verifyWebhook(BODY, bad, SECRET, NOW)).toBe(false);
  });

  it("rejects an empty signature, which would otherwise compare equal to nothing", () => {
    expect(verifyWebhook(BODY, headers({ signature: "v1," }), SECRET, NOW)).toBe(false);
  });

  it("rejects when no secret is configured, rather than accepting everything", () => {
    expect(verifyWebhook(BODY, headers(), "", NOW)).toBe(false);
  });

  it("tolerates the secret being given with or without its prefixes", () => {
    const bare = "c2VjcmV0LWtleS1mb3ItdGVzdGluZy1vbmx5";
    expect(verifyWebhook(BODY, headers(), bare, NOW)).toBe(true);
    expect(verifyWebhook(BODY, headers(), `whsec_${bare}`, NOW)).toBe(true);
  });
});
