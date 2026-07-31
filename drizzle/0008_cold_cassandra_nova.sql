CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"participant_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "organizer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_event_email_unique" ON "invitations" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "invitations_event_sent_idx" ON "invitations" USING btree ("event_id","sent_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "participants" DROP COLUMN "edit_token";