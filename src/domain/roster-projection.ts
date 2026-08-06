/**
 * The role boundary, as a projection.
 *
 * **In `domain/` and not beside the loader, on purpose.** `lib/roster.ts`
 * imports the database client at module scope, so anything living there cannot
 * be unit tested — and the one rule in this file is precisely the kind that has
 * to be tested rather than reviewed, because breaking it produces a page that
 * looks completely correct.
 *
 * The types come in as `import type`, which is erased at compile time, so
 * nothing here pulls the ORM in behind it. `lib/roster.ts` re-exports all three
 * names, so callers keep importing from where the rest of the roster lives.
 */
import type { Share } from "@/domain/split";
import type { RosterMember, RosterView } from "@/lib/roster";

/**
 * One person on the roster, as the PARTICIPANT surface is allowed to see them.
 *
 * `userId` is dropped outright: it is an account identifier, it is not
 * rendered anywhere on the participant page, and it was crossing the wire to
 * every reader — including a signed-out one holding the link. Nobody needs to
 * know which account is behind a name on a roster in order to read the roster.
 *
 * `share` is nullable rather than dropped, because whether it belongs depends
 * on who is reading — see {@link toParticipantView}. Null means "not this
 * reader's to see", which is a value a component can branch on; the type is
 * what makes it impossible to render the number without deciding first.
 */
export type ParticipantRosterMember = Omit<RosterMember, "userId" | "share" | "guests"> & {
  share: Share | null;
  /**
   * Guest names only — the claim token is STRIPPED here, deliberately. The
   * roster crosses the wire to everybody holding the public link, and a claim
   * token in that payload would let any reader take a seat that was held for
   * somebody specific. The sponsor gets their own links through their own
   * loader field, the way `ownCommitment` travels.
   */
  guests: { id: string; name: string }[];
};

/**
 * The event as the participant surface sees it.
 *
 * **This type is the role split, expressed where it can actually be enforced.**
 * The card asks that organizer-only affordances be "absent for participants,
 * not merely hidden", and a conditional in a component cannot deliver that —
 * whatever the loader returns is in the HTML whether or not anything renders
 * it. What makes an affordance absent is the data not being there, so the
 * boundary is a type and a projection rather than a check at the point of use.
 *
 * What the participant surface keeps is what a participant can act on: who is
 * coming, what they themselves owe, and the pot everybody is contributing to.
 *
 * **The money is shared among participants and with nobody else.** An event
 * where four people split a cancha is one where all four can see the total —
 * that has always been the rule and it has not changed. What changed is the
 * reader it was measured against: a public token is a link, and a link travels,
 * so "everybody who can open the page" and "everybody who is in on it" are not
 * the same set. Somebody with no session is the second kind of reader, and how
 * much is still owed on a plan they are not part of is not theirs.
 *
 * Nullable rather than absent so the components have something to branch on,
 * and so this stays one type instead of two that drift.
 */
export type ParticipantRosterView = Omit<
  RosterView,
  | "compliance"
  | "pendingReview"
  | "promotable"
  | "discrepancies"
  | "members"
  | "attending"
  | "confirmed"
  | "pendingPolicy"
  | "notAttending"
  | "maybe"
  | "waitlisted"
  | "collectedMinor"
  | "outstandingMinor"
  | "waivedMinor"
  | "totalComputedMinor"
> & {
  /** Null for a reader with no session. See the note above. */
  collectedMinor: number | null;
  outstandingMinor: number | null;
  waivedMinor: number | null;
  totalComputedMinor: number | null;
  members: ParticipantRosterMember[];
  attending: ParticipantRosterMember[];
  confirmed: ParticipantRosterMember[];
  pendingPolicy: ParticipantRosterMember[];
  notAttending: ParticipantRosterMember[];
  maybe: ParticipantRosterMember[];
  waitlisted: ParticipantRosterMember[];
};

/**
 * Drops everything the organizer console owns before the view crosses the wire.
 *
 * Four fields, and each one is an organizer's job rather than a participant's
 * business:
 *
 * - **`pendingReview`** — how many receipts are waiting on the organizer. It
 *   drives a badge on a queue only they can open.
 * - **`promotable`** — how many people could be moved off the waitlist. Only
 *   the organizer can move them.
 * - **`discrepancies`** — who paid an amount that does not match their share.
 *   This one names people and mismatches, and is the most clearly not-yours of
 *   the four.
 * - **`compliance`** — everybody's standing against every policy. Already
 *   stripped before this existed, by hand, at the one call site that remembered
 *   to. That is exactly the failure mode a projection removes.
 *
 * Plus `userId` on every member. See {@link ParticipantRosterMember}.
 *
 * **And the money, for a reader with no session.** Ivan's call, after the
 * stranger preview showed him what it looks like: somebody who opens a
 * forwarded link reads "Recaudado $ 0 · Falta $ 80.000" through the sign-in
 * card before they have said who they are. The roster survives, because names
 * are the hook — seeing that four friends are already in is the reason to
 * join. How much is still owed on a plan you are not part of is not.
 *
 * Zeroed out here rather than hidden in the component, for the reason the file
 * exists: what a component does not render is still in the HTML, and the
 * person this protects against is exactly the one who would look.
 */
export function toParticipantView(
  roster: RosterView,
  reader: { signedIn: boolean },
): ParticipantRosterView {
  /*
    Each person is stripped ONCE and every list points at that same object.

    Not a micro-optimisation — it is the difference between the payload
    shrinking and growing. The seven lists below are overlapping views of the
    same people (`confirmed` and `pendingPolicy` partition `attending`, which is
    a subset of `members`), and the loader's serialiser writes a shared object
    once and refers back to it afterwards. A `map` per list produces seven
    distinct objects for one person, so the same names get written out three or
    four times over.

    Measured, because the first version did exactly that: an eight-person
    roster went from 37.8 KB to 39.4 KB while REMOVING four fields.
  */
  const stripped = new Map<string, ParticipantRosterMember>(
    roster.members.map(({ userId: _userId, share, guests, ...rest }) => [
      rest.id,
      {
        ...rest,
        share: reader.signedIn ? share : null,
        guests: guests.map(({ id, name }) => ({ id, name })),
      },
    ]),
  );

  const strip = (members: RosterMember[]): ParticipantRosterMember[] =>
    members
      .map((member) => stripped.get(member.id))
      .filter((member): member is ParticipantRosterMember => member !== undefined);

  return {
    event: roster.event,
    policies: roster.policies,
    members: strip(roster.members),
    // Every list below hands back the SAME objects `members` holds.
    attending: strip(roster.attending),
    confirmed: strip(roster.confirmed),
    pendingPolicy: strip(roster.pendingPolicy),
    notAttending: strip(roster.notAttending),
    maybe: strip(roster.maybe),
    waitlisted: strip(roster.waitlisted),
    collectedMinor: reader.signedIn ? roster.collectedMinor : null,
    outstandingMinor: reader.signedIn ? roster.outstandingMinor : null,
    waivedMinor: reader.signedIn ? roster.waivedMinor : null,
    totalComputedMinor: reader.signedIn ? roster.totalComputedMinor : null,
    openSlots: roster.openSlots,
  };
}
