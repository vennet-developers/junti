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

/**
 * Broadcasts "changed" on the event's topic after a mutation that took, so
 * every OTHER open page re-reads its loaders too — the caller's own
 * `router.invalidate()` only refreshes the person who clicked. Success is
 * exactly what the callers already test: an empty `errors` record. Applied
 * here, at the RPC boundary, so no action body has to remember it — a
 * mutation nobody announces is how "aprobado" sat on one screen while the
 * other still said "pendiente". Runs server-side only; the dynamic import
 * keeps this browser-bound module clean of server code.
 */
async function pinged<T extends { errors: Record<string, string> }>(
  publicToken: string,
  result: T,
): Promise<T> {
  if (Object.keys(result.errors).length === 0) {
    const { pingEvent } = await import("@/lib/live");
    await pingEvent(publicToken);
  }
  return result;
}

export const submitRsvpFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { submitRsvp } = await import("./-actions.server");
    return pinged(token(data), await submitRsvp(token(data), data));
  });

export const joinOneTapFn = createServerFn({ method: "POST" })
  .validator((data: { publicToken: string }) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { joinOneTap } = await import("./-actions.server");
    return pinged(data.publicToken, await joinOneTap(data.publicToken));
  });

export const submitPolicyResponseFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<SubmissionState> => {
    const { submitPolicyResponse } = await import("./-actions.server");
    return pinged(token(data), await submitPolicyResponse(token(data), data));
  });

export const saveCommitmentFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { saveCommitment } = await import("./-actions.server");
    return pinged(token(data), await saveCommitment(token(data), data));
  });

export const deleteCommitmentFn = createServerFn({ method: "POST" })
  .validator((data: { publicToken: string; noteId: string }) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { deleteCommitment } = await import("./-actions.server");
    return pinged(data.publicToken, await deleteCommitment(data.publicToken, data.noteId));
  });

export const holdSpotsFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { holdSpots } = await import("./-actions.server");
    return pinged(token(data), await holdSpots(token(data), data));
  });

export const releaseSpotFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<RsvpState> => {
    const { releaseSpot } = await import("./-actions.server");
    return pinged(token(data), await releaseSpot(token(data), data));
  });
