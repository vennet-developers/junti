import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  customType,
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
 * `timestamptz` and stored in UTC; the timezone and language they are rendered
 * in are properties of the event, not of the server.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export const eventKind = pgEnum("event_kind", ["match", "party", "kids_party", "other"]);

export const costMode = pgEnum("cost_mode", ["none", "total", "per_person"]);

export const attendance = pgEnum("attendance", ["in", "out", "maybe", "waitlisted"]);

export const paymentStatus = pgEnum("payment_status", ["pending", "confirmed", "waived"]);

/**
 * What a policy asks of a participant.
 *
 * - `proof_of_payment` — upload an image, then wait for the organizer to
 *   approve it. The only kind whose fulfilment someone else decides.
 * - `acknowledgement` — tick a box. Self-served: submitting IS fulfilling,
 *   there is nothing for the organizer to judge.
 */
export const policyKind = pgEnum("policy_kind", ["proof_of_payment", "acknowledgement"]);

/**
 * Deliberately has no "pending" member. A participant who has not responded to
 * a policy has NO row, and absence is the pending state. A status that means
 * "this row exists to say nothing happened" would need creating for every
 * participant × policy pair on every write.
 */
export const policySubmissionStatus = pgEnum("policy_submission_status", [
  "submitted",
  "approved",
  "rejected",
]);

/**
 * `bytea` as a Node Buffer.
 *
 * Drizzle has no first-class bytea column, and the generic `blob` helpers are
 * SQLite/MySQL only. postgres.js already maps bytea ↔ Buffer in both
 * directions, so this only has to name the type for the migration generator.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

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

    /**
     * IANA identifier — "America/Bogota", "Europe/Madrid". The wall-clock time
     * this event happens at.
     *
     * A property of the event, not of the viewer: a match at 8 p.m. in Medellín
     * is at 8 p.m. for everyone reading the roster, including the one person
     * abroad. Rendering it in each reader's local zone would tell the traveller
     * a different time from the rest of the group.
     *
     * Text rather than an enum because the tz database gains and renames zones
     * every few months, and pinning the set would mean a migration each time.
     * Validated on the way in — see `src/lib/time-zones.ts`.
     */
    timeZone: text("time_zone").notNull().default("America/Bogota"),

    /**
     * The language the organizer created this event in, used as the default for
     * readers who have not picked one themselves.
     *
     * Only affects the interface. Everything a human typed — title, notes,
     * names — is stored and shown exactly as written, in whatever language it
     * was written; translating a friend's note would be worse than leaving it.
     */
    locale: text("locale").notNull().default("es"),

    /** Null means unlimited. */
    capacity: integer("capacity"),
    notes: text("notes"),

    costMode: costMode("cost_mode").notNull().default("none"),

    /** Minor units of `currency`. Null when costMode is 'none'. */
    costAmountMinor: bigint("cost_amount_minor", { mode: "number" }),

    currency: char("currency", { length: 3 }).notNull().default("COP"),

    /** When set, RSVPs are frozen. */
    closedAt: timestamp("closed_at", { withTimezone: true }),

    /**
     * The signed-in account that created this event, or null when it was
     * created anonymously (the original token-only flow, still supported).
     *
     * Deliberately a plain uuid with NO foreign key to `auth.users`. A
     * cross-schema FK would tie these migrations to Supabase specifically, and
     * the schema is meant to run unchanged on any Postgres — see DECISIONS.md
     * #22. The column means "the identity that owns this event"; today that
     * identity comes from Supabase Auth, and swapping the provider would not
     * require a migration.
     */
    organizerId: uuid("organizer_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("events_starts_at_idx").on(table.startsAt),
    /**
     * The organizer's history: their events, newest first. Descending on
     * `created_at` so the index order matches the query and Postgres can walk
     * it without a sort.
     */
    index("events_organizer_created_idx").on(table.organizerId, table.createdAt.desc()),
  ],
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

    /**
     * Set when this RSVP came from a signed-in account, null for the anonymous
     * flow — which remains the common case and the one the product is built
     * around.
     *
     * Its value is that it survives what the cookie does not: a signed-in
     * person can amend their RSVP from a different phone, or after clearing
     * their browser. Same reasoning as `events.organizer_id` for the absent
     * foreign key to `auth.users`.
     */
    userId: uuid("user_id"),

    /**
     * Copied from the identity provider at RSVP time rather than fetched.
     *
     * Denormalised on purpose: there is no profile table, the session is the
     * only other place this exists, and the roster has to render for readers
     * who are not signed in at all. A stale photo is a much smaller problem
     * than a roster that cannot draw itself.
     */
    avatarUrl: text("avatar_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Case-insensitive uniqueness per event. Stops the same person appearing
     * twice when they RSVP again from a different device.
     */
    uniqueIndex("participants_event_name_unique").on(
      table.eventId,
      sql`lower(${table.displayName})`,
    ),
    /**
     * One RSVP per account per event.
     *
     * Needs no `where user_id is not null`: Postgres treats NULLs as distinct
     * in a unique index, so any number of anonymous participants coexist here
     * while two RSVPs from the same account cannot.
     */
    uniqueIndex("participants_event_user_unique").on(table.eventId, table.userId),
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
 * A condition an event puts on being counted as confirmed.
 *
 * The suggested set depends on the kind of event — a match proposes proof of
 * payment, a kids' party proposes an acknowledgement — but nothing is imposed:
 * the organizer picks, renames and reorders. `label` is what participants
 * actually read, so it carries whatever wording the organizer chose, in their
 * own language, and is never translated.
 */
export const eventPolicies = pgTable(
  "event_policies",
  {
    id: uuid("id").primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    kind: policyKind("kind").notNull(),

    /** Shown to participants and used in "waiting on <label>". 1–60 chars. */
    label: text("label").notNull(),

    /** Optional instructions: where to transfer, what the photo should show. */
    description: text("description"),

    /** Display order within the event. */
    position: integer("position").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("event_policies_event_position_idx").on(table.eventId, table.position)],
);

/**
 * One participant's response to one policy.
 *
 * No row means they have not responded yet — see `policySubmissionStatus`.
 */
export const policySubmissions = pgTable(
  "policy_submissions",
  {
    id: uuid("id").primaryKey(),

    policyId: uuid("policy_id")
      .notNull()
      .references(() => eventPolicies.id, { onDelete: "cascade" }),

    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),

    status: policySubmissionStatus("status").notNull().default("submitted"),

    /** The participant's own words: a transfer reference, "paid in cash". */
    note: text("note"),

    /** The organizer's reason when rejecting, shown back to the participant. */
    reviewNote: text("review_note"),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("policy_submissions_policy_participant_unique").on(
      table.policyId,
      table.participantId,
    ),
    index("policy_submissions_participant_idx").on(table.participantId),
  ],
);

/**
 * The uploaded image itself, kept in its own table so the bytes are never
 * dragged along by accident.
 *
 * `select().from(policySubmissions)` reads every column of that table. Had the
 * image lived there, drawing the roster would have pulled every receipt of
 * every participant out of the database to render a status chip. A separate
 * table makes that mistake impossible rather than merely discouraged.
 *
 * Why Postgres and not object storage: the free tier keeps zero backups, so
 * `pnpm db:export` is the only copy that exists — and bytes in a table are in
 * that dump, while bytes in a bucket are not. See DECISIONS.md. Everything that
 * touches this table goes through `src/lib/evidence-store.ts`, which is the one
 * file that has to change to move the bytes elsewhere later.
 */
export const policyEvidence = pgTable("policy_evidence", {
  submissionId: uuid("submission_id")
    .primaryKey()
    .references(() => policySubmissions.id, { onDelete: "cascade" }),

  /** Sniffed from the leading bytes on upload, never trusted from the client. */
  mimeType: text("mime_type").notNull(),

  /** Redundant with `length(bytes)`, but readable without detoasting. */
  sizeBytes: integer("size_bytes").notNull(),

  bytes: bytea("bytes").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
export type EventPolicyRow = typeof eventPolicies.$inferSelect;
export type NewEventPolicyRow = typeof eventPolicies.$inferInsert;
export type PolicySubmissionRow = typeof policySubmissions.$inferSelect;
export type NewPolicySubmissionRow = typeof policySubmissions.$inferInsert;

export type EventKind = (typeof eventKind.enumValues)[number];
export type CostMode = (typeof costMode.enumValues)[number];
export type Attendance = (typeof attendance.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type PolicyKind = (typeof policyKind.enumValues)[number];
export type PolicySubmissionStatus = (typeof policySubmissionStatus.enumValues)[number];
