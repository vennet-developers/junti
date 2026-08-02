import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { policyEvidence } from "@/db/schema";

/**
 * Where uploaded proof lives.
 *
 * **This is the seam.** Every read and write of an uploaded image goes through
 * this module and nothing else touches `policy_evidence`, so moving the bytes
 * to object storage later is this file plus a script that copies rows — not a
 * refactor that reaches into pages and actions.
 *
 * Postgres today, for one reason that outweighs the rest: the Supabase free
 * tier keeps **zero** backups, which makes `pnpm db:export` the only copy of
 * anything that exists. Bytes in a table are inside that dump. Bytes in a
 * bucket are not, and would be unrecoverable exactly when it matters. Storage
 * would also need either RLS — which this project bans — or server-signed URLs,
 * and would drag `@supabase/supabase-js` back in after it was deliberately
 * removed.
 *
 * The trade is real and bounded: at ~150 KB per receipt, the 500 MB database
 * allowance is roughly 3,000 images, and the sensible ceiling is lower than
 * that. COSTS.md records where the line is and what crossing it costs.
 */

/**
 * Hard cap on a stored image, after the browser has already shrunk it.
 *
 * 400 KB is comfortably above what a 1400px JPEG of a bank receipt comes to,
 * and low enough that a thousand of them is a fraction of the allowance. The
 * client aims far below it; this is the backstop for a client that did not.
 */
export const EVIDENCE_MAX_BYTES = 400_000;

export interface StoredEvidence {
  mimeType: string;
  sizeBytes: number;
  bytes: Buffer;
}

/**
 * Identifies an image from its leading bytes.
 *
 * The browser's `File.type` is not consulted, because it is a claim by the
 * client and this is the boundary where claims stop being taken at face value.
 * Content sniffing is what decides, so renaming `payload.html` to `receipt.jpg`
 * gets nowhere.
 *
 * Returns null for anything that is not one of the three formats.
 */
export function sniffImageMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // FF D8 FF — every JPEG variant starts here.
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // 89 "PNG" CR LF SUB LF
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  // "RIFF" ‹4 byte length› "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return "image/webp";
  }

  return null;
}

export type EvidenceRejection = "too_large" | "wrong_type" | "unreadable";

export type EvidenceCheck =
  { ok: true; mimeType: string; bytes: Buffer } | { ok: false; reason: EvidenceRejection };

/** Validates an upload without touching the database. */
export function checkEvidence(raw: ArrayBuffer): EvidenceCheck {
  if (raw.byteLength === 0) return { ok: false, reason: "unreadable" };
  if (raw.byteLength > EVIDENCE_MAX_BYTES) return { ok: false, reason: "too_large" };

  const view = new Uint8Array(raw);
  const mimeType = sniffImageMimeType(view);

  if (!mimeType) return { ok: false, reason: "wrong_type" };

  return { ok: true, mimeType, bytes: Buffer.from(view) };
}

/**
 * Saves the image for a submission, replacing whatever was there.
 *
 * Upsert rather than insert, because re-sending after a rejection reuses the
 * same submission row and the old image should not linger.
 */
export async function putEvidence(
  submissionId: string,
  evidence: { mimeType: string; bytes: Buffer },
): Promise<void> {
  await db
    .insert(policyEvidence)
    .values({
      submissionId,
      mimeType: evidence.mimeType,
      sizeBytes: evidence.bytes.byteLength,
      bytes: evidence.bytes,
    })
    .onConflictDoUpdate({
      target: policyEvidence.submissionId,
      set: {
        mimeType: evidence.mimeType,
        sizeBytes: evidence.bytes.byteLength,
        bytes: evidence.bytes,
      },
    });
}

/**
 * The image itself. Only ever called from the organizer-only route — the bytes
 * must never reach the participant page, which the whole group can open.
 */
export async function getEvidence(submissionId: string): Promise<StoredEvidence | null> {
  const [row] = await db
    .select({
      mimeType: policyEvidence.mimeType,
      sizeBytes: policyEvidence.sizeBytes,
      bytes: policyEvidence.bytes,
    })
    .from(policyEvidence)
    .where(eq(policyEvidence.submissionId, submissionId))
    .limit(1);

  return row ?? null;
}

/**
 * Whether an image exists, without reading it.
 *
 * Deliberately selects only `sizeBytes`: the point is to render "view receipt"
 * or "no photo attached" without pulling a few hundred kilobytes out of the
 * database to answer a yes/no question.
 */
export async function hasEvidence(submissionId: string): Promise<boolean> {
  const [row] = await db
    .select({ sizeBytes: policyEvidence.sizeBytes })
    .from(policyEvidence)
    .where(eq(policyEvidence.submissionId, submissionId))
    .limit(1);

  return row !== undefined;
}

/**
 * Drops the image but keeps the decision.
 *
 * **Called on every approval**, from both places that can approve. Once a
 * receipt is accepted, the record that it *was* accepted is what the organizer
 * needs; the photograph of somebody's banking app is a liability with no
 * remaining purpose, sitting in the one table that consumes real space in a
 * database with no backups.
 *
 * Approval only. A rejection means the participant has to send something else,
 * and destroying what they sent would leave both sides arguing about an image
 * neither can look at.
 */
export async function deleteEvidence(submissionId: string): Promise<void> {
  await db.delete(policyEvidence).where(eq(policyEvidence.submissionId, submissionId));
}

/**
 * The same, for a batch.
 *
 * One statement rather than a loop: the approvals queue exists so an organizer
 * can clear fifteen receipts at once, and doing that as fifteen round trips on
 * a pooled connection is how a feature built for speed becomes the slow one.
 *
 * Callers must pass ids they have already authorized. This deletes what it is
 * given and checks nothing — the ownership question belongs with the update
 * that decided them.
 */
export async function deleteEvidenceFor(submissionIds: string[]): Promise<void> {
  if (submissionIds.length === 0) return;
  await db.delete(policyEvidence).where(inArray(policyEvidence.submissionId, submissionIds));
}
