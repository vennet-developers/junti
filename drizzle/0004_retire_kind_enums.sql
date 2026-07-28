ALTER TABLE "event_policies" ALTER COLUMN "policy_definition_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_policies" ALTER COLUMN "label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "event_type_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "event_policies_event_definition_unique" ON "event_policies" USING btree ("event_id","policy_definition_id");--> statement-breakpoint
ALTER TABLE "event_policies" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "kind";--> statement-breakpoint
DROP TYPE "public"."event_kind";--> statement-breakpoint
DROP TYPE "public"."policy_kind";