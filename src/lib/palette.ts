/**
 * The app's one way of turning a string into a colour.
 *
 * Two places need it — the attendee avatars and the event cards' header band —
 * and both want the same property: the same input always lands on the same
 * colour, so a person keeps their colour across every event and a kind of
 * event keeps its colour down the whole list. Nothing is stored to achieve
 * that; the string is the seed.
 *
 * Which colours those indexes mean is deliberately not here. Both sides now
 * pass a prop — the avatars a `tone`, the cards a colour on `Box`. Same six
 * steps of the palette, chosen the same way.
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

/**
 * The six tones an avatar can take, in palette order.
 *
 * These used to be six hand-written classes in `globals.css`, each setting
 * `--sm-avatar-bg` and `--sm-avatar-fallback-text` by hand — because `Avatar`
 * exposed a `color` prop and nothing for the text that sits on it. Stackmyth
 * 0.25.4 added `tone`, which sets the pair from the theme and inverts it in
 * dark mode, so the classes are gone and this is a lookup.
 */
const AVATAR_TONES = ["info", "success", "warning", "error", "accent", "primary"] as const;

/**
 * A person's avatar colour, as an `Avatar` tone.
 *
 * Shared by the roster and the stack on an event card so the same person is the
 * same colour in both — which is the whole point of seeding from the name.
 */
export function avatarToneFor(name: string): (typeof AVATAR_TONES)[number] {
  return AVATAR_TONES[paletteIndexFor(name)];
}
