-- Enable row-level security on every public table.
--
-- These tables shipped with RLS OFF, which Supabase's dashboard flags as
-- "UNRESTRICTED" and which means exactly what it says: the project's Data API
-- (PostgREST) exposes the schema, and the roles it authenticates as — `anon`
-- and `authenticated` — reach every row with the PUBLISHABLE key that ships in
-- the browser bundle. Verified live: `GET /rest/v1/payments`, `.../user_profiles`,
-- `.../outbox_messages` all returned rows with nothing but that public key.
--
-- This app never uses the Data API. Every read and write goes through Drizzle
-- over a direct Postgres connection as the `postgres` role, and authorization
-- lives in server code behind unguessable tokens (see DECISIONS.md). So the
-- correct posture is deny-all to PostgREST and let the application role through:
--
--   - ENABLE ROW LEVEL SECURITY with NO policies denies `anon`/`authenticated`
--     every row — the REST API goes dark.
--   - The `postgres` role Drizzle connects as has `rolbypassrls = true`
--     (verified), so the application is completely unaffected. No policy is
--     written precisely because none should exist: a policy would be a rule for
--     an access path this app does not use.
--
-- Realtime Broadcast is untouched — it authorizes by topic, not by table RLS —
-- and Supabase Auth lives in the `auth` schema, not here. This closes the leak
-- and changes nothing the app does.

ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_suppressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_type_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "heartbeat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "held_spots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "send_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
