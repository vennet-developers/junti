/* ---------------------------------------------------------------------------
 * Invitations stop naming an address and start naming an account.
 *
 * This is the migration that answers the legal spike by removing its subject.
 * The column held the email of somebody who had never given it to us — an
 * organizer pasted it — and there was no lawful basis to reason about because
 * there was no relationship to point at. With groups, an invitation can only
 * name a person who already said yes to this organizer inside the app, so the
 * address is neither needed nor kept.
 *
 * The backfill runs FIRST and matches on the verified address in
 * `auth.users`: an invitation to somebody who never registered has no account
 * to point at and is deleted rather than guessed at. That is the correct
 * outcome — those are precisely the rows nobody had permission to hold.
 * ------------------------------------------------------------------------ */

UPDATE "invitations" i
SET "user_id" = u.id
FROM auth.users u
WHERE lower(u.email) = i.email AND i."user_id" IS NULL;--> statement-breakpoint

DELETE FROM "invitations" WHERE "user_id" IS NULL;--> statement-breakpoint

DROP INDEX "invitations_event_email_unique";--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_event_user_unique" ON "invitations" USING btree ("event_id","user_id");--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "email";