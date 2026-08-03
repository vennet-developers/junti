/* ---------------------------------------------------------------------------
 * Catalogue second pass: fold the kids' party into the party, add the two
 * plans people actually collect money for.
 *
 * The kids' party earned its row when it was the only way to pre-select
 * "read the instructions" — the policy editor of the time only showed what a
 * type suggested. Now the editor shows the whole catalogue behind switches,
 * so a type whose only difference is one pre-flipped switch is picker
 * friction, not information. Retired, not deleted: the event that carries it
 * keeps rendering (both foreign keys are restrict), it just leaves the picker.
 *
 * The cookout and the trip come in because they are the money-pooling plans —
 * the case proof of payment exists for — so both suggest it pre-added. The
 * trip also suggests the acknowledgement (what to bring, when the bus leaves),
 * switched off.
 *
 * New rows use the seed's fixed-id convention but match associations by slug,
 * for the same reason 0003's backfill did: a hand-populated catalogue links to
 * its own rows instead of failing.
 * ------------------------------------------------------------------------ */

UPDATE "event_types" SET "is_active" = false WHERE "slug" = 'kids_party';--> statement-breakpoint

/* "Other" stays last: it is the escape hatch, not a suggestion. */
UPDATE "event_types" SET "position" = 4 WHERE "slug" = 'other';--> statement-breakpoint

INSERT INTO "event_types" ("id", "slug", "labels", "position") VALUES
  ('00000000-0000-4000-8000-000000000005', 'cookout', '{"es":"Asado","en":"Cookout"}', 2),
  ('00000000-0000-4000-8000-000000000006', 'trip',    '{"es":"Paseo","en":"Trip"}',    3)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

INSERT INTO "event_type_policies" ("event_type_id", "policy_definition_id", "position", "is_default")
SELECT et.id, pd.id, v.position, v.is_default
FROM (VALUES
  ('cookout', 'proof_of_payment', 0, true),
  ('trip',    'proof_of_payment', 0, true),
  ('trip',    'acknowledgement',  1, false)
) AS v (type_slug, policy_slug, position, is_default)
JOIN "event_types" et ON et."slug" = v.type_slug
JOIN "policy_definitions" pd ON pd."slug" = v.policy_slug
ON CONFLICT DO NOTHING;
