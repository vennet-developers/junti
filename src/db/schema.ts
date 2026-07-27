import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema for the event roster and payment ledger.
 *
 * Vocabulary is domain-level (event / participant / payment / organizer) so the
 * product can be renamed without touching the database. All timestamps are
 * `timestamptz` and stored in UTC; formatting for America/Bogota happens in the
 * presentation layer only.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export const eventKind = pgEnum("event_kind", ["match", "party", "kids_party", "other"]);

export const costMode = pgEnum("cost_mode", ["none", "total", "per_person"]);

export const attendance = pgEnum("attendance", ["in", "out", "maybe", "waitlisted"]);

export const paymentStatus = pgEnum("payment_status", ["pending", "confirmed", "waived"]);

// ── Tables ───────────────────────────────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey(),

    /**
     * Participant access. 12+ URL-safe characters from crypto.randomBytes.
     * Anyone holding this may read the roster and RSVP.
     */
    publicToken: text("public_token").notNull().unique(),

    /**
     * Organizer access. 24+ URL-safe characters from crypto.randomBytes.
     * Must never be sent to the client on a participant route.
     */
    organizerToken: text("organizer_token").notNull().unique(),

    title: text("title").notNull(),
    kind: eventKind("kind").notNull().default("other"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    location: text("location"),

    /** Null means unlimited. */
    capacity: integer("capacity"),
    notes: text("notes"),

    costMode: costMode("cost_mode").notNull().default("none"),

    /** Minor units of `currency`. Null when costMode is 'none'. */
    costAmountMinor: bigint("cost_amount_minor", { mode: "number" }),

    currency: char("currency", { length: 3 }).notNull().default("COP"),

    /** When set, RSVPs are frozen. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("events_starts_at_idx").on(table.startsAt)],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    /** 1–40 characters, enforced by Zod at every boundary. */
    displayName: text("display_name").notNull(),

    attendance: attendance("attendance").notNull().default("in"),

    /**
     * Lets one device amend its own RSVP without an account. Stored in a cookie
     * on the participant's browser; never displayed.
     */
    editToken: text("edit_token").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Case-insensitive uniqueness per event. Stops the same person appearing
     * twice when they RSVP again from a different device.
     */
    uniqueIndex("participants_event_name_unique").on(table.eventId, sql`lower(${table.displayName})`),
    index("participants_event_created_idx").on(table.eventId, table.createdAt),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey(),

    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" })
      .unique(),

    /** What this person actually owes, or — once confirmed — actually paid. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),

    status: paymentStatus("status").notNull().default("pending"),

    /** Free text: nequi, cash, transfer… The app never validates or uses it. */
    method: text("method"),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [index("payments_participant_idx").on(table.participantId)],
);

/**
 * Single-row table poked by /api/keep-alive so Supabase does not pause the free
 * project after ~7 days of inactivity. Not part of the domain.
 */
export const heartbeat = pgTable("heartbeat", {
  id: integer("id").primaryKey(),
  beatAt: timestamp("beat_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Inferred types ───────────────────────────────────────────────────────────

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type ParticipantRow = typeof participants.$inferSelect;
export type NewParticipantRow = typeof participants.$inferInsert;
export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;

export type EventKind = (typeof eventKind.enumValues)[number];
export type CostMode = (typeof costMode.enumValues)[number];
export type Attendance = (typeof attendance.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
