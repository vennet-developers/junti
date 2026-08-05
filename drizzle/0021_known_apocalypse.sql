CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dedupe_key" text NOT NULL,
	"template" text NOT NULL,
	"recipient" text NOT NULL,
	"locale" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_messages_dedupe_unique" ON "outbox_messages" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "outbox_messages_due_idx" ON "outbox_messages" USING btree ("status","next_attempt_at");