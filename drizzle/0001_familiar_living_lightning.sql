ALTER TABLE "events" ADD COLUMN "organizer_id" uuid;--> statement-breakpoint
CREATE INDEX "events_organizer_created_idx" ON "events" USING btree ("organizer_id","created_at" DESC NULLS LAST);