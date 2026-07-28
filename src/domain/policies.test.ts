import { describe, expect, it } from "vitest";

import {
  initialSubmissionStatus,
  isSelfApproving,
  isSubjectToPolicies,
  isSupported,
  partitionByCompliance,
  pendingReviewCount,
  resolveCompliance,
  resolveParticipantCompliance,
  type Policy,
  type PolicySubmission,
} from "./policies";
import { POLICY_HANDLERS } from "./policy-handlers";

const payment: Policy = {
  id: "policy-payment",
  definitionId: "def-payment",
  handler: "file_upload_reviewed",
  label: "Comprobante de pago",
  description: null,
  labelOverride: null,
  descriptionOverride: null,
  position: 0,
};

const rules: Policy = {
  id: "policy-rules",
  definitionId: "def-rules",
  handler: "self_acknowledged",
  label: "Leí las indicaciones",
  description: "Están en la descripción del evento.",
  labelOverride: null,
  descriptionOverride: null,
  position: 1,
};

/** A catalogue row naming a behaviour this build does not implement. */
const fromTheFuture: Policy = {
  id: "policy-future",
  definitionId: "def-future",
  handler: "digital_signature",
  label: "Firma digital",
  description: null,
  labelOverride: null,
  descriptionOverride: null,
  position: 2,
};

function submission(
  policyId: string,
  participantId: string,
  status: PolicySubmission["status"],
): PolicySubmission {
  return { policyId, participantId, status };
}

describe("resolveParticipantCompliance", () => {
  it("is compliant when the event has no policies at all", () => {
    const result = resolveParticipantCompliance("ana", [], []);

    expect(result.compliant).toBe(true);
    expect(result.blocking).toEqual([]);
    expect(result.standings).toEqual([]);
  });

  it("treats a policy with no submission as missing, and blocking", () => {
    const result = resolveParticipantCompliance("ana", [payment], []);

    expect(result.compliant).toBe(false);
    expect(result.standings).toEqual([{ policy: payment, state: "missing" }]);
    expect(result.blocking).toEqual([payment]);
    expect(result.awaitingReview).toEqual([]);
  });

  it("still blocks while a submission is waiting on the organizer", () => {
    const result = resolveParticipantCompliance(
      "ana",
      [payment],
      [submission(payment.id, "ana", "submitted")],
    );

    expect(result.compliant).toBe(false);
    expect(result.blocking).toEqual([payment]);
    expect(result.awaitingReview).toEqual([payment]);
    expect(result.rejected).toEqual([]);
  });

  it("blocks a rejected submission, and reports it separately from a missing one", () => {
    const result = resolveParticipantCompliance(
      "ana",
      [payment],
      [submission(payment.id, "ana", "rejected")],
    );

    expect(result.compliant).toBe(false);
    expect(result.blocking).toEqual([payment]);
    expect(result.rejected).toEqual([payment]);
    expect(result.awaitingReview).toEqual([]);
  });

  it("is compliant once every policy is approved", () => {
    const result = resolveParticipantCompliance(
      "ana",
      [payment, rules],
      [submission(payment.id, "ana", "approved"), submission(rules.id, "ana", "approved")],
    );

    expect(result.compliant).toBe(true);
    expect(result.blocking).toEqual([]);
  });

  it("requires ALL policies, not just one", () => {
    const result = resolveParticipantCompliance(
      "ana",
      [payment, rules],
      [submission(payment.id, "ana", "approved")],
    );

    expect(result.compliant).toBe(false);
    expect(result.blocking).toEqual([rules]);
  });

  it("ignores submissions belonging to other participants", () => {
    const result = resolveParticipantCompliance(
      "ana",
      [payment],
      [submission(payment.id, "beto", "approved")],
    );

    expect(result.compliant).toBe(false);
    expect(result.blocking).toEqual([payment]);
  });

  it("orders standings by position, not by the order policies arrive in", () => {
    const result = resolveParticipantCompliance("ana", [rules, payment], []);

    expect(result.standings.map((s) => s.policy.id)).toEqual([payment.id, rules.id]);
  });

  it("breaks a position tie deterministically so the roster does not reshuffle", () => {
    const tied: Policy = { ...rules, position: 0 };
    const first = resolveParticipantCompliance("ana", [tied, payment], []);
    const second = resolveParticipantCompliance("ana", [payment, tied], []);

    expect(first.standings.map((s) => s.policy.id)).toEqual(
      second.standings.map((s) => s.policy.id),
    );
  });
});

describe("resolveCompliance", () => {
  it("returns an entry for every participant, including ones who submitted nothing", () => {
    const result = resolveCompliance(
      ["ana", "beto"],
      [payment],
      [submission(payment.id, "ana", "approved")],
    );

    expect(result.get("ana")?.compliant).toBe(true);
    expect(result.get("beto")?.compliant).toBe(false);
    expect(result.size).toBe(2);
  });
});

describe("partitionByCompliance", () => {
  const ana = { id: "ana" };
  const beto = { id: "beto" };
  const caro = { id: "caro" };

  it("splits attendees into confirmed and pending", () => {
    const compliance = resolveCompliance(
      ["ana", "beto"],
      [payment],
      [submission(payment.id, "ana", "approved")],
    );

    const { confirmed, pending } = partitionByCompliance([ana, beto], compliance);

    expect(confirmed).toEqual([ana]);
    expect(pending).toEqual([beto]);
  });

  it("preserves join order within each group", () => {
    const compliance = resolveCompliance(["ana", "beto", "caro"], [payment], []);

    const { pending } = partitionByCompliance([ana, beto, caro], compliance);

    expect(pending).toEqual([ana, beto, caro]);
  });

  it("counts anyone missing from the map as confirmed", () => {
    // An event with no policies produces no compliance entries at all.
    const { confirmed, pending } = partitionByCompliance([ana, beto], new Map());

    expect(confirmed).toEqual([ana, beto]);
    expect(pending).toEqual([]);
  });
});

describe("who policies apply to", () => {
  it("applies only to people who said they are coming", () => {
    expect(isSubjectToPolicies("in")).toBe(true);
    expect(isSubjectToPolicies("out")).toBe(false);
    expect(isSubjectToPolicies("maybe")).toBe(false);
    // Asking a waitlisted person to pay for a spot they do not have.
    expect(isSubjectToPolicies("waitlisted")).toBe(false);
  });
});

describe("who approves a submission", () => {
  it("settles an acknowledgement on submission", () => {
    expect(isSelfApproving(rules)).toBe(true);
    expect(initialSubmissionStatus(rules)).toBe("approved");
  });

  it("sends proof of payment to the organizer", () => {
    expect(isSelfApproving(payment)).toBe(false);
    expect(initialSubmissionStatus(payment)).toBe("submitted");
  });

  it("means an acknowledgement never blocks once submitted", () => {
    const result = resolveParticipantCompliance(
      "ana",
      [rules],
      [submission(rules.id, "ana", initialSubmissionStatus(rules))],
    );

    expect(result.compliant).toBe(true);
  });

  it("puts a human in the loop for a handler it does not recognise", () => {
    // Unreachable through the UI, so the conservative fallback is the one that
    // does not auto-confirm.
    expect(isSelfApproving(fromTheFuture)).toBe(false);
    expect(initialSubmissionStatus(fromTheFuture)).toBe("submitted");
  });
});

describe("a policy naming a handler this build does not have", () => {
  it("is reported as unsupported", () => {
    expect(isSupported(payment)).toBe(true);
    expect(isSupported(fromTheFuture)).toBe(false);
  });

  it("does NOT block, because nobody could act on it", () => {
    const result = resolveParticipantCompliance("ana", [fromTheFuture], []);

    expect(result.blocking).toEqual([]);
    expect(result.unsupported).toEqual([fromTheFuture]);
    // Fail-safe: operator error should be loud, not paralysing.
    expect(result.compliant).toBe(true);
  });

  it("still lets the policies around it block normally", () => {
    const result = resolveParticipantCompliance("ana", [payment, fromTheFuture], []);

    expect(result.blocking).toEqual([payment]);
    expect(result.unsupported).toEqual([fromTheFuture]);
    expect(result.compliant).toBe(false);
  });

  it("keeps somebody out of the pending section on its own", () => {
    const compliance = resolveCompliance(["ana"], [fromTheFuture], []);
    const { confirmed, pending } = partitionByCompliance([{ id: "ana" }], compliance);

    expect(confirmed).toEqual([{ id: "ana" }]);
    expect(pending).toEqual([]);
  });
});

describe("pendingReviewCount", () => {
  it("counts only what is actually waiting on the organizer", () => {
    const submissions = [
      submission(payment.id, "ana", "submitted"),
      submission(payment.id, "beto", "submitted"),
      submission(payment.id, "caro", "approved"),
      submission(payment.id, "dani", "rejected"),
    ];

    expect(pendingReviewCount(submissions)).toBe(2);
  });

  it("is zero on an empty queue", () => {
    expect(pendingReviewCount([])).toBe(0);
  });
});

describe("POLICY_HANDLERS", () => {
  it("keys every handler by its own name, so the registry cannot disagree with itself", () => {
    for (const [key, handler] of Object.entries(POLICY_HANDLERS)) {
      expect(handler.key).toBe(key);
    }
  });

  it("covers the handlers the seeded catalogue references", () => {
    // These strings are in `policy_definitions.handler` in a live database.
    // Renaming one here without a data migration would strand those rows.
    expect(POLICY_HANDLERS.file_upload_reviewed).toBeDefined();
    expect(POLICY_HANDLERS.self_acknowledged).toBeDefined();
  });

  it("asks for an image exactly when a human has to look at one", () => {
    expect(POLICY_HANDLERS.file_upload_reviewed.evidence).toBe("image");
    expect(POLICY_HANDLERS.file_upload_reviewed.settledBy).toBe("organizer");

    expect(POLICY_HANDLERS.self_acknowledged.evidence).toBe("none");
    expect(POLICY_HANDLERS.self_acknowledged.settledBy).toBe("participant");
  });
});
