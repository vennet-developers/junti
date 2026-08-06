CREATE TABLE "held_spots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"sponsor_participant_id" uuid NOT NULL,
	"guest_name" text,
	"claim_token" text NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "held_spots_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
ALTER TABLE "held_spots" ADD CONSTRAINT "held_spots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "held_spots" ADD CONSTRAINT "held_spots_sponsor_participant_id_participants_id_fk" FOREIGN KEY ("sponsor_participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "held_spots_event_idx" ON "held_spots" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "held_spots_sponsor_idx" ON "held_spots" USING btree ("sponsor_participant_id");