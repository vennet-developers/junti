CREATE TABLE "credits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"origin_event_id" uuid,
	"applied_minor" bigint DEFAULT 0 NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "credit_applied_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_origin_event_id_events_id_fk" FOREIGN KEY ("origin_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credits_user_organizer_idx" ON "credits" USING btree ("user_id","organizer_id");--> statement-breakpoint
-- Same posture as every other table here: the Data API is not how this app
-- reads its data, and a new table shipped without this is a new leak. RLS on,
-- no policies, `postgres` (which Drizzle connects as) bypasses it. See
-- 0030_lock_the_data_api.sql.
ALTER TABLE "credits" ENABLE ROW LEVEL SECURITY;
