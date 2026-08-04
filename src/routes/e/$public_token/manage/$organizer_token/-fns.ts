import { createServerFn } from "@tanstack/react-start";

import type { InviteState, ManageState } from "./-actions.server";

/**
 * The eight organizer mutations, as server functions.
 *
 * Same shape as the participant page's `-fns.ts`: thin RPC wrappers over the
 * ported `"use server"` module, which stays server-only behind dynamic
 * imports. The two forms (invite, edit) take FormData with the token pair as
 * hidden fields; the six button-bound mutations take typed objects. Every
 * caller follows success with `router.invalidate()` — the replacement for
 * the `refresh()` helper that revalidated both views.
 */

export type { InviteState, ManageState };

/** The token pair every mutation is scoped by, from a form's hidden fields. */
const pair = (data: FormData) => ({
  publicToken: String(data.get("publicToken") ?? ""),
  organizerToken: String(data.get("organizerToken") ?? ""),
});

interface Tokens {
  publicToken: string;
  organizerToken: string;
}

export const setPaymentStatusFn = createServerFn({ method: "POST" })
  .validator((data: Tokens & { participantId: string; status: string; method?: string }) => data)
  .handler(async ({ data }): Promise<ManageState> => {
    const { setPaymentStatus } = await import("./-actions.server");
    return setPaymentStatus(
      data.publicToken,
      data.organizerToken,
      data.participantId,
      data.status,
      data.method,
    );
  });

export const inviteToEventFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<InviteState> => {
    const { inviteToEvent } = await import("./-actions.server");
    const { publicToken, organizerToken } = pair(data);
    return inviteToEvent(publicToken, organizerToken, data);
  });

export const resendInvitationFn = createServerFn({ method: "POST" })
  .validator((data: Tokens & { invitationId: string }) => data)
  .handler(async ({ data }): Promise<InviteState> => {
    const { resendInvitation } = await import("./-actions.server");
    return resendInvitation(data.publicToken, data.organizerToken, data.invitationId);
  });

export const removeParticipantFn = createServerFn({ method: "POST" })
  .validator((data: Tokens & { participantId: string }) => data)
  .handler(async ({ data }): Promise<ManageState> => {
    const { removeParticipant } = await import("./-actions.server");
    return removeParticipant(data.publicToken, data.organizerToken, data.participantId);
  });

export const promoteParticipantFn = createServerFn({ method: "POST" })
  .validator((data: Tokens & { participantId: string }) => data)
  .handler(async ({ data }): Promise<ManageState> => {
    const { promoteParticipant } = await import("./-actions.server");
    return promoteParticipant(data.publicToken, data.organizerToken, data.participantId);
  });

export const setEventClosedFn = createServerFn({ method: "POST" })
  .validator((data: Tokens & { closed: boolean }) => data)
  .handler(async ({ data }): Promise<ManageState> => {
    const { setEventClosed } = await import("./-actions.server");
    return setEventClosed(data.publicToken, data.organizerToken, data.closed);
  });

export const editEventFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<ManageState> => {
    const { editEvent } = await import("./-actions.server");
    const { publicToken, organizerToken } = pair(data);
    return editEvent(publicToken, organizerToken, data);
  });

export const reviewSubmissionFn = createServerFn({ method: "POST" })
  .validator((data: Tokens & { submissionId: string; decision: string; reason?: string }) => data)
  .handler(async ({ data }): Promise<ManageState> => {
    const { reviewSubmission } = await import("./-actions.server");
    return reviewSubmission(
      data.publicToken,
      data.organizerToken,
      data.submissionId,
      data.decision,
      data.reason,
    );
  });
