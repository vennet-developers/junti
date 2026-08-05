CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"source" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_name_at_idx" ON "analytics_events" USING btree ("name","at" DESC NULLS LAST);