CREATE TYPE "public"."attendance" AS ENUM('in', 'out', 'maybe', 'waitlisted');--> statement-breakpoint
CREATE TYPE "public"."cost_mode" AS ENUM('none', 'total', 'per_person');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('match', 'party', 'kids_party', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'waived');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_token" text NOT NULL,
	"organizer_token" text NOT NULL,
	"title" text NOT NULL,
	"kind" "event_kind" DEFAULT 'other' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"location" text,
	"capacity" integer,
	"notes" text,
	"cost_mode" "cost_mode" DEFAULT 'none' NOT NULL,
	"cost_amount_minor" bigint,
	"currency" char(3) DEFAULT 'COP' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "events_organizer_token_unique" UNIQUE("organizer_token")
);
--> statement-breakpoint
CREATE TABLE "heartbeat" (
	"id" integer PRIMARY KEY NOT NULL,
	"beat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"attendance" "attendance" DEFAULT 'in' NOT NULL,
	"edit_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"participant_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"method" text,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "payments_participant_id_unique" UNIQUE("participant_id")
);
--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_event_name_unique" ON "participants" USING btree ("event_id",lower("display_name"));--> statement-breakpoint
CREATE INDEX "participants_event_created_idx" ON "participants" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_participant_idx" ON "payments" USING btree ("participant_id");