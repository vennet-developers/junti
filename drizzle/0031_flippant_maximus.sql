ALTER TABLE "events" ADD COLUMN "min_attendees" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "postponed_at" timestamp with time zone;