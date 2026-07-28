CREATE TYPE "public"."policy_kind" AS ENUM('proof_of_payment', 'acknowledgement');--> statement-breakpoint
CREATE TYPE "public"."policy_submission_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "event_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" "policy_kind" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_evidence" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"policy_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"status" "policy_submission_status" DEFAULT 'submitted' NOT NULL,
	"note" text,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "time_zone" text DEFAULT 'America/Bogota' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "locale" text DEFAULT 'es' NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "event_policies" ADD CONSTRAINT "event_policies_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_evidence" ADD CONSTRAINT "policy_evidence_submission_id_policy_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."policy_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_submissions" ADD CONSTRAINT "policy_submissions_policy_id_event_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."event_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_submissions" ADD CONSTRAINT "policy_submissions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_policies_event_position_idx" ON "event_policies" USING btree ("event_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "policy_submissions_policy_participant_unique" ON "policy_submissions" USING btree ("policy_id","participant_id");--> statement-breakpoint
CREATE INDEX "policy_submissions_participant_idx" ON "policy_submissions" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_event_user_unique" ON "participants" USING btree ("event_id","user_id");