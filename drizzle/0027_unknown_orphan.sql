ALTER TABLE "events" ADD COLUMN "refund_notice_hours" integer;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "out_at" timestamp with time zone;