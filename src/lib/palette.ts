/**
 * The app's one way of turning a string into a colour.
 *
 * Two places need it — the attendee avatars and the event cards' header band —
 * and both want the same property: the same input always lands on the same
 * colour, so a person keeps their colour across every event and a kind of
 * event keeps its colour down the whole list. Nothing is stored to achieve
 * that; the string is the seed.
 *
 * Which colours those indexes mean is deliberately not here. The avatars carry
 * theirs as token pairs in `globals.css` because `Avatar` reads custom
 * properties; the cards pass theirs as props because `Box` takes colours as
 * props. Same six steps of the palette, chosen the same way, applied through
 * whichever door each component leaves open.
 */
export const PALETTE_SIZE = 6;

/**
 * FNV-1a, 32-bit. Any stable hash would do — this one is short, has no
 * dependencies and spreads short strings well, which is what a first name and
 * a catalogue id both are.
 */
export function paletteIndexFor(seed: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash % PALETTE_SIZE;
}
