import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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

export const costMode = pgEnum("cost_mode", ["none", "total", "per_person"]);

export const attendance = pgEnum("attendance", ["in", "out", "maybe", "waitlisted"]);

export const paymentStatus = pgEnum("payment_status", ["pending", "confirmed", "waived"]);

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

// ── Catalogues ───────────────────────────────────────────────────────────────

/**
 * Names in every language the interface speaks: `{"es": "Partido", "en": "Match"}`.
 *
 * `jsonb` rather than a `*_translations` table on purpose. A translation table
 * buys referential integrity on the locale key and costs a join on every read
 * plus a second table to seed and administer; with a closed set of locales
 * declared in code and a fallback chain for a missing one, that integrity is
 * not worth the weight here. Adding a language is an UPDATE, not a migration,
 * which is the property that actually mattered.
 *
 * Read through `pickLabel()` — never index it directly, or a language somebody
 * has not translated yet renders as `undefined`.
 */
type Labels = Record<string, string>;

/**
 * The kinds of event an organizer can pick.
 *
 * A table rather than the `event_kind` enum it replaces. Adding "tournament" or
 * "asado" used to be a migration, a code change and a deploy; it is now one
 * row. That is the whole reason this exists.
 *
 * Rows are **retired, never deleted** — `is_active = false` takes a type out of
 * the picker while leaving every event that already used it intact. The foreign
 * key from `events` is `restrict` precisely so a careless DELETE cannot take
 * somebody's event with it.
 */
export const eventTypes = pgTable(
  "event_types",
  {
    id: uuid("id").primaryKey(),

    /**
     * Stable key. Code that genuinely must special-case a type refers to this,
     * never to a label or an id — labels get renamed and ids differ between
     * environments.
     */
    slug: text("slug").notNull().unique(),

    labels: jsonb("labels").$type<Labels>().notNull(),

    /** Order in the picker. */
    position: integer("position").notNull().default(0),

    /** False hides it from new events without touching existing ones. */
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("event_types_active_position_idx").on(table.isActive, table.position)],
);

/**
 * The catalogue of policies. **The source of truth for what a policy is.**
 *
 * An event does not invent a requirement; it points at a row here. Renaming
 * "Comprobante de pago" fixes the wording on every event that inherited it.
 *
 * The important column is `handler`, and the important thing about it is what
 * it does NOT do: it does not describe behaviour, it *names* it. A row cannot
 * ship a file input, a canvas resizer, a byte sniffer and a review screen, so
 * behaviour stays in code and this string is the contract between the two. See
 * `src/domain/policy-handlers.ts`.
 */
export const policyDefinitions = pgTable(
  "policy_definitions",
  {
    id: uuid("id").primaryKey(),

    slug: text("slug").notNull().unique(),

    /**
     * Which registered behaviour this policy uses.
     *
     * Deliberately separate from `slug` so several catalogue entries can share
     * one behaviour: "Comprobante de pago" and "Comprobante de inscripción" are
     * two rows a participant sees differently and one `file_upload_reviewed`
     * implementation. That is the difference between adding a policy (a row)
     * and adding a kind of policy (code).
     */
    handler: text("handler").notNull(),

    labels: jsonb("labels").$type<Labels>().notNull(),

    /** Default instructions. An event may override them per policy. */
    descriptions: jsonb("descriptions").$type<Labels>(),

    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("policy_definitions_active_position_idx").on(table.isActive, table.position),
    index("policy_definitions_handler_idx").on(table.handler),
  ],
);

/**
 * Which policies each kind of event offers.
 *
 * Association only — attaching "proof of payment" to "tournament" is a row, and
 * so is detaching it. Nothing here forces anything on an organizer: this
 * decides what the create form *offers*, and `is_default` decides what it
 * starts with already added.
 */
export const eventTypePolicies = pgTable(
  "event_type_policies",
  {
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),

    policyDefinitionId: uuid("policy_definition_id")
      .notNull()
      .references(() => policyDefinitions.id, { onDelete: "cascade" }),

    position: integer("position").notNull().default(0),

    /** Pre-added on the create form rather than merely offered. */
    isDefault: boolean("is_default").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.eventTypeId, table.policyDefinitionId] }),
    index("event_type_policies_type_position_idx").on(table.eventTypeId, table.position),
  ],
);

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

    /**
     * `restrict`, not `cascade`: retiring a kind of event must never be able to
     * delete somebody's event as a side effect. Take it out of circulation with
     * `is_active` instead.
     */
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "restrict" }),

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
 * One policy, attached to one event.
 *
 * This is an **instance**, not a definition: it points at the catalogue row
 * that says what the requirement is and how it behaves, and adds only what is
 * specific to this event.
 */
export const eventPolicies = pgTable(
  "event_policies",
  {
    id: uuid("id").primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    /**
     * `restrict` again: a definition that events are using cannot be deleted
     * out from under them. Retire it with `is_active`.
     */
    policyDefinitionId: uuid("policy_definition_id")
      .notNull()
      .references(() => policyDefinitions.id, { onDelete: "restrict" }),

    /**
     * The organizer's own wording, or NULL to follow the catalogue.
     *
     * Null is the default and the interesting case: it means fixing a typo in
     * the definition fixes it on every event that never overrode it, which is
     * what makes the catalogue a source of truth rather than a template that
     * was copied once. A non-null value is text a human typed, so it is shown
     * verbatim and never translated.
     */
    label: text("label"),

    description: text("description"),

    /** Display order within the event. */
    position: integer("position").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("event_policies_event_position_idx").on(table.eventId, table.position),
    /** One instance of a given requirement per event. */
    uniqueIndex("event_policies_event_definition_unique").on(
      table.eventId,
      table.policyDefinitionId,
    ),
  ],
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
 * A signed-in person's own settings, so they follow them to a new device.
 *
 * **NULL means "follow my browser"**, which is why both columns are nullable
 * and there is no separate `override_enabled` flag. Setting a value IS turning
 * the override on, and clearing it is turning it off — one piece of state
 * instead of two that can contradict each other.
 *
 * The durable record only. The per-device effective value lives in a cookie,
 * because the server has to know it to render the first paint in the right
 * language; this table is what re-seeds that cookie when the same person signs
 * in somewhere new.
 *
 * No foreign key to `auth.users`, for the same reason as `events.organizer_id`:
 * a cross-schema FK would tie these migrations to Supabase, and the schema is
 * meant to run unchanged on any Postgres.
 */
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),

  /** Interface language, or NULL to follow `Accept-Language`. */
  locale: text("locale"),

  /** IANA identifier for reading times, or NULL to follow the device. */
  timeZone: text("time_zone"),

  /**
   * "light" | "dark", or NULL to follow the operating system.
   *
   * Text rather than an enum for the same reason as `locale`: a third value
   * (a high-contrast theme, say) should be a deploy, not a migration.
   */
  theme: text("theme"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type EventTypeRow = typeof eventTypes.$inferSelect;
export type PolicyDefinitionRow = typeof policyDefinitions.$inferSelect;
export type EventTypePolicyRow = typeof eventTypePolicies.$inferSelect;
export type PolicySubmissionRow = typeof policySubmissions.$inferSelect;
export type NewPolicySubmissionRow = typeof policySubmissions.$inferInsert;

export type CostMode = (typeof costMode.enumValues)[number];
export type Attendance = (typeof attendance.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type PolicySubmissionStatus = (typeof policySubmissionStatus.enumValues)[number];
