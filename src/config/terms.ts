/**
 * When the terms of service last changed in substance.
 *
 * Separate from `POLICY_VERSION`, and not because a second constant is tidy:
 * the two documents answer different questions and change for different
 * reasons. The privacy notice changes when the DATA changes — a new class
 * collected, one stopped. This changes when the DEAL changes — what the
 * product promises to do and refuses to do.
 *
 * Unlike the policy version, this one is not written into any consent row.
 * Nobody is asked to tick a box agreeing to these; using the product is the
 * acceptance, which is why the date on the page matters — it is the only way
 * somebody can tell whether what they read last year still holds.
 *
 * Bump it only for a change of substance. Fixing a typo is not a new version,
 * and a version that moves for cosmetic edits teaches people to ignore it.
 *
 * 2026-08-05: first published. Written when Google's OAuth consent screen
 * required a public terms URL, which is a poor reason to write terms and a
 * perfectly good reason to stop putting it off — the product had been making
 * these promises in its copy and its code for months with nowhere that said so
 * plainly.
 */
export const TERMS_VERSION = "2026-08-05";
