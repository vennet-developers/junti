import { createServerFn } from "@tanstack/react-start";

import type { RsvpState, SubmissionState } from "./-actions.server";

/**
 * The five participant mutations, as server functions.
 *
 * Thin wrappers by design: the logic lives verbatim in `-actions.server.ts`
 * (the ported `"use server"` module), and these only cross the RPC boundary.
 * The split keeps the 600-line port reviewable against its Next original —
 * and keeps this file, which DOES ride to the browser, free of server
 * imports; the tripwire enforces that at runtime and the bundle scan at
 * build.
 *
 * `publicToken` travels inside the FormData (the forms already carry it as a
 * hidden field) or in the typed object, because a server function takes one
 * argument. Next's `revalidatePath` calls are gone from the server half;
 * every caller follows a successful mutation with `router.invalidate()`.
 */

export type { RsvpState, SubmissionState };

const token = (data: FormData) => String(data.get("publicToken") ?? "");

export const submitRsvpFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { submitRsvp } = await import("./-actions.server");
    return submitRsvp(token(data), data);
  });

export const joinOneTapFn = createServerFn({ method: "POST" })
  .validator((data: { publicToken: string }) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { joinOneTap } = await import("./-actions.server");
    return joinOneTap(data.publicToken);
  });

export const submitPolicyResponseFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<SubmissionState> => {
    const { submitPolicyResponse } = await import("./-actions.server");
    return submitPolicyResponse(token(data), data);
  });

export const saveCommitmentFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { saveCommitment } = await import("./-actions.server");
    return saveCommitment(token(data), data);
  });

export const deleteCommitmentFn = createServerFn({ method: "POST" })
  .validator((data: { publicToken: string; noteId: string }) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { deleteCommitment } = await import("./-actions.server");
    return deleteCommitment(data.publicToken, data.noteId);
  });

export const holdSpotsFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { holdSpots } = await import("./-actions.server");
    return holdSpots(token(data), data);
  });

export const releaseSpotFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { releaseSpot } = await import("./-actions.server");
    return releaseSpot(token(data), data);
  });
