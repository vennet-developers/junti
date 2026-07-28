CREATE TABLE "event_type_policies" (
	"event_type_id" uuid NOT NULL,
	"policy_definition_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "event_type_policies_event_type_id_policy_definition_id_pk" PRIMARY KEY("event_type_id","policy_definition_id")
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"labels" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "policy_definitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"handler" text NOT NULL,
	"labels" jsonb NOT NULL,
	"descriptions" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_definitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_policies" ADD COLUMN "policy_definition_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type_id" uuid;--> statement-breakpoint
ALTER TABLE "event_type_policies" ADD CONSTRAINT "event_type_policies_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_type_policies" ADD CONSTRAINT "event_type_policies_policy_definition_id_policy_definitions_id_fk" FOREIGN KEY ("policy_definition_id") REFERENCES "public"."policy_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_type_policies_type_position_idx" ON "event_type_policies" USING btree ("event_type_id","position");--> statement-breakpoint
CREATE INDEX "event_types_active_position_idx" ON "event_types" USING btree ("is_active","position");--> statement-breakpoint
CREATE INDEX "policy_definitions_active_position_idx" ON "policy_definitions" USING btree ("is_active","position");--> statement-breakpoint
CREATE INDEX "policy_definitions_handler_idx" ON "policy_definitions" USING btree ("handler");--> statement-breakpoint
ALTER TABLE "event_policies" ADD CONSTRAINT "event_policies_policy_definition_id_policy_definitions_id_fk" FOREIGN KEY ("policy_definition_id") REFERENCES "public"."policy_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

/* ---------------------------------------------------------------------------
 * Seed the catalogues.
 *
 * The four event kinds and two policies that used to be Postgres enums and a
 * TypeScript constant. Deterministic UUIDs so every environment agrees on the
 * ids and the backfill below can name them, and `on conflict do nothing` so
 * re-running is harmless.
 *
 * This is data, in a migration, on purpose: without it a freshly migrated
 * database has no event types and the create form has nothing to offer, which
 * would make `pnpm db:migrate` insufficient to get a working app.
 * ------------------------------------------------------------------------ */

INSERT INTO "event_types" ("id", "slug", "labels", "position") VALUES
  ('00000000-0000-4000-8000-000000000001', 'match',      '{"es":"Partido","en":"Match"}',              0),
  ('00000000-0000-4000-8000-000000000002', 'party',      '{"es":"Fiesta","en":"Party"}',               1),
  ('00000000-0000-4000-8000-000000000003', 'kids_party', '{"es":"Fiesta infantil","en":"Kids'' party"}', 2),
  ('00000000-0000-4000-8000-000000000004', 'other',      '{"es":"Otro","en":"Other"}',                 3)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

INSERT INTO "policy_definitions" ("id", "slug", "handler", "labels", "descriptions", "position") VALUES
  ('00000000-0000-4000-9000-000000000001', 'proof_of_payment', 'file_upload_reviewed',
   '{"es":"Comprobante de pago","en":"Proof of payment"}',
   '{"es":"Sube una foto del pago para que el organizador la revise.","en":"Upload a photo of the payment for the organizer to review."}', 0),
  ('00000000-0000-4000-9000-000000000002', 'acknowledgement', 'self_acknowledged',
   '{"es":"Leí las indicaciones","en":"I read the instructions"}',
   '{"es":"Marca la casilla para confirmar que las leíste.","en":"Tick the box to confirm you have read them."}', 1)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

/* Which policies each kind of event offers. `is_default` pre-adds it on the
 * create form; the rest are merely offered. */
INSERT INTO "event_type_policies" ("event_type_id", "policy_definition_id", "position", "is_default") VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-9000-000000000001', 0, true),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-9000-000000000001', 0, false),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-9000-000000000002', 1, false),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-9000-000000000002', 0, true)
ON CONFLICT DO NOTHING;--> statement-breakpoint

/* ---------------------------------------------------------------------------
 * Backfill, then make the new columns required.
 *
 * Matching on slug rather than on the seeded ids, so a database whose catalogue
 * was already populated by hand links to its own rows instead of failing.
 * ------------------------------------------------------------------------ */

UPDATE "events" e
   SET "event_type_id" = t."id"
  FROM "event_types" t
 WHERE t."slug" = e."kind"::text
   AND e."event_type_id" IS NULL;--> statement-breakpoint

UPDATE "event_policies" p
   SET "policy_definition_id" = d."id"
  FROM "policy_definitions" d
 WHERE d."slug" = p."kind"::text
   AND p."policy_definition_id" IS NULL;--> statement-breakpoint

/* Anything the join could not resolve is data we do not understand, and
 * leaving it would mean an event with no type. Fail loudly instead. */
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events" WHERE "event_type_id" IS NULL) THEN
    RAISE EXCEPTION 'backfill left events without an event_type_id';
  END IF;
  IF EXISTS (SELECT 1 FROM "event_policies" WHERE "policy_definition_id" IS NULL) THEN
    RAISE EXCEPTION 'backfill left event_policies without a policy_definition_id';
  END IF;
END $$;
