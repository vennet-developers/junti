import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { eventNotes, participants } from "@/db/schema";

/**
 * Reading the commitment feed.
 *
 * One query, joined to the roster for the name and photo, ordered newest
 * first. Loaded by the event page itself rather than fetched by the client
 * after mount: the feed is the reason somebody opens the link a second time,
 * and a spinner where the answer should be defeats that.
 */

export interface CommitmentView {
  id: string;
  participantId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  note: string | null;
  reaction: string | null;
  createdAt: Date;
}

/**
 * The first page of the feed.
 *
 * Capped rather than paginated. A roster is capped by capacity and there is at
 * most one note per participant, so "the whole feed" is bounded by the size of
 * the event — the limit is a guard against a pathological case, not a page
 * control somebody is expected to click past.
 */
export async function loadCommitments(eventId: string, limit = 50): Promise<CommitmentView[]> {
  const rows = await db
    .select({
      id: eventNotes.id,
      participantId: eventNotes.participantId,
      note: eventNotes.note,
      reaction: eventNotes.reaction,
      createdAt: eventNotes.createdAt,
      authorName: participants.displayName,
      authorAvatarUrl: participants.avatarUrl,
    })
    .from(eventNotes)
    .innerJoin(participants, eq(participants.id, eventNotes.participantId))
    .where(eq(eventNotes.eventId, eventId))
    .orderBy(desc(eventNotes.createdAt))
    .limit(limit);

  return rows;
}

/** This participant's own note, for pre-filling the box they edit. */
export async function loadOwnCommitment(participantId: string): Promise<CommitmentView | null> {
  const [row] = await db
    .select({
      id: eventNotes.id,
      participantId: eventNotes.participantId,
      note: eventNotes.note,
      reaction: eventNotes.reaction,
      createdAt: eventNotes.createdAt,
      authorName: participants.displayName,
      authorAvatarUrl: participants.avatarUrl,
    })
    .from(eventNotes)
    .innerJoin(participants, eq(participants.id, eventNotes.participantId))
    .where(eq(eventNotes.participantId, participantId))
    .limit(1);

  return row ?? null;
}
