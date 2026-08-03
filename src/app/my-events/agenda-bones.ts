import type { Bone, BoneLibrary } from "@stackmyth/skeleton/auto";

/**
 * The agenda's skeleton, captured from a real render and committed.
 *
 * This is the seeding half of the `AutoSkeleton` pair in this folder: without
 * it the very first visit ever has nothing to replay and falls back to generic
 * bars. Registered at module scope in `agenda-fallback.tsx`, it gives that
 * first visit the same traced skeleton every later one gets — the boneyard
 * idea of build-time capture, with a browser session standing in for the
 * headless browser, so no Playwright and no build step.
 *
 * **This file is data, not a drawing.** Nobody tunes these numbers by hand.
 * To refresh after the agenda's layout changes:
 *
 *   1. Open `/my-events` signed in, in a **visible** tab (a frozen background
 *      tab never captures), at the width you want to reseed.
 *   2. In the console:
 *      `copy(sessionStorage.getItem("sm-skeleton-bones:my-events-agenda"))`
 *   3. Paste over `CAPTURED` below and re-run the formatter.
 *
 * Going stale is safe by design: a live session re-captures on every render of
 * the real agenda, and `putBones` replaces the seeded bucket in memory and in
 * storage. The seed only ever decides what the first paint of a wait looks
 * like — never the second.
 *
 * Captured at 848px (the `md` bucket). Narrower widths reuse it scaled by the
 * percentage-based x/w; that shows the two-column drawing on a phone's first
 * visit, which is wrong for one load and then corrected by the first real
 * capture on that device. Committing a phone-bucket capture too would close
 * that gap — step 1 at a narrow width — it just has not been needed yet.
 */
const BONES_768: Bone[] = [
  { x: 0, y: 0, w: 100, h: 50, r: 13, container: true },
  { x: 1.533, y: 16, w: 2.123, h: 18, r: "50%" },
  { x: 5.071, y: 1, w: 94.811, h: 48, r: 4 },
  { x: 0, y: 66, w: 100, h: 54, r: 13, container: true },
  { x: 0.59, y: 71, w: 32.94, h: 44, r: 8 },
  { x: 33.529, y: 71, w: 32.941, h: 44, r: 8 },
  { x: 66.47, y: 71, w: 32.941, h: 44, r: 8 },
  { x: 0, y: 152, w: 49.292, h: 245, r: 13, container: true },
  { x: 0.118, y: 153, w: 49.057, h: 47, r: 4, container: true },
  { x: 2.948, y: 169, w: 5.327, h: 16, r: 4 },
  { x: 20.132, y: 169, w: 26.212, h: 16, r: 4 },
  { x: 2.948, y: 216, w: 16.618, h: 26, r: 4 },
  { x: 29.823, y: 216, w: 8.297, h: 17, r: 13 },
  { x: 39.063, y: 216, w: 7.281, h: 17, r: 13 },
  { x: 2.948, y: 254, w: 1.651, h: 14, r: "50%" },
  { x: 5.542, y: 253, w: 5.356, h: 16, r: 4 },
  { x: 2.948, y: 281, w: 3.774, h: 32, r: "50%" },
  { x: 0.118, y: 329, w: 49.057, h: 1, r: 4 },
  { x: 2.948, y: 350, w: 7.606, h: 26, r: 4 },
  { x: 11.498, y: 356, w: 2.26, h: 16, r: 4 },
  { x: 20.341, y: 346, w: 9.662, h: 34, r: 9999 },
  { x: 30.947, y: 346, w: 10.68, h: 34, r: 9999 },
  { x: 42.571, y: 347, w: 3.774, h: 32, r: "50%" },
  { x: 50.708, y: 152, w: 49.292, h: 245, r: 13, container: true },
  { x: 50.825, y: 153, w: 49.057, h: 47, r: 4, container: true },
  { x: 53.656, y: 169, w: 4.394, h: 16, r: 4 },
  { x: 69.578, y: 169, w: 27.474, h: 16, r: 4 },
  { x: 53.656, y: 216, w: 15.608, h: 26, r: 4 },
  { x: 84.49, y: 216, w: 4.337, h: 17, r: 13 },
  { x: 89.771, y: 216, w: 7.281, h: 17, r: 13 },
  { x: 53.656, y: 254, w: 1.651, h: 14, r: "50%" },
  { x: 56.25, y: 253, w: 8.829, h: 16, r: 4 },
  { x: 53.656, y: 281, w: 3.774, h: 32, r: "50%" },
  { x: 50.825, y: 329, w: 49.057, h: 1, r: 4 },
  { x: 53.656, y: 350, w: 7.938, h: 26, r: 4 },
  { x: 62.537, y: 356, w: 2.26, h: 16, r: 4 },
  { x: 87.096, y: 346, w: 9.956, h: 34, r: 9999 },
  { x: 0, y: 409, w: 49.292, h: 245, r: 13, container: true },
  { x: 0.118, y: 410, w: 49.057, h: 47, r: 4, container: true },
  { x: 2.948, y: 426, w: 5.327, h: 16, r: 4 },
  { x: 19.39, y: 426, w: 26.954, h: 16, r: 4 },
  { x: 2.948, y: 472, w: 16.899, h: 26, r: 4 },
  { x: 33.783, y: 472, w: 4.337, h: 17, r: 13 },
  { x: 39.063, y: 472, w: 7.281, h: 17, r: 13 },
  { x: 2.948, y: 511, w: 1.651, h: 14, r: "50%" },
  { x: 5.542, y: 510, w: 9.934, h: 16, r: 4 },
  { x: 2.948, y: 538, w: 3.774, h: 32, r: "50%" },
  { x: 5.542, y: 538, w: 3.774, h: 32, r: "50%" },
  { x: 0.118, y: 586, w: 49.057, h: 1, r: 4 },
  { x: 2.948, y: 607, w: 8.168, h: 26, r: 4 },
  { x: 36.388, y: 603, w: 9.956, h: 34, r: 9999 },
  { x: 50.708, y: 409, w: 49.292, h: 245, r: 13, container: true },
  { x: 50.825, y: 410, w: 49.057, h: 47, r: 4, container: true },
  { x: 53.656, y: 426, w: 9.708, h: 16, r: 4 },
  { x: 70.098, y: 426, w: 26.954, h: 16, r: 4 },
  { x: 53.656, y: 472, w: 17.818, h: 26, r: 4 },
  { x: 82.597, y: 472, w: 6.231, h: 17, r: 13 },
  { x: 89.771, y: 472, w: 7.281, h: 17, r: 13 },
  { x: 53.656, y: 511, w: 1.651, h: 14, r: "50%" },
  { x: 56.25, y: 510, w: 10.514, h: 16, r: 4 },
  { x: 53.656, y: 538, w: 43.396, h: 16, r: 4 },
  { x: 50.825, y: 570, w: 49.057, h: 1, r: 4 },
  { x: 53.656, y: 591, w: 5.324, h: 26, r: 4 },
  { x: 87.096, y: 587, w: 9.956, h: 34, r: 9999 },
  { x: 0, y: 666, w: 49.292, h: 245, r: 13, container: true },
  { x: 0.118, y: 667, w: 49.057, h: 47, r: 4, container: true },
  { x: 2.948, y: 683, w: 5.327, h: 16, r: 4 },
  { x: 18.845, y: 683, w: 27.499, h: 16, r: 4 },
  { x: 2.948, y: 729, w: 16.256, h: 26, r: 4 },
  { x: 29.933, y: 729, w: 8.187, h: 17, r: 13 },
  { x: 39.063, y: 729, w: 7.281, h: 17, r: 13 },
  { x: 2.948, y: 768, w: 1.651, h: 14, r: "50%" },
  { x: 5.542, y: 767, w: 9.76, h: 16, r: 4 },
  { x: 2.948, y: 795, w: 3.774, h: 32, r: "50%" },
  { x: 0.118, y: 843, w: 49.057, h: 1, r: 4 },
  { x: 2.948, y: 864, w: 8.137, h: 26, r: 4 },
  { x: 12.028, y: 870, w: 2.26, h: 16, r: 4 },
  { x: 36.388, y: 860, w: 9.956, h: 34, r: 9999 },
  { x: 50.708, y: 666, w: 49.292, h: 245, r: 13, container: true },
  { x: 50.825, y: 667, w: 49.057, h: 47, r: 4, container: true },
  { x: 53.656, y: 683, w: 3.346, h: 16, r: 4 },
  { x: 68.935, y: 683, w: 28.117, h: 16, r: 4 },
  { x: 53.656, y: 729, w: 10.083, h: 26, r: 4 },
  { x: 82.67, y: 729, w: 6.158, h: 17, r: 13 },
  { x: 89.771, y: 729, w: 7.281, h: 17, r: 13 },
  { x: 53.656, y: 768, w: 1.651, h: 14, r: "50%" },
  { x: 56.25, y: 767, w: 15.544, h: 16, r: 4 },
  { x: 53.656, y: 795, w: 43.396, h: 16, r: 4 },
  { x: 50.825, y: 827, w: 49.057, h: 1, r: 4 },
  { x: 53.656, y: 848, w: 5.324, h: 26, r: 4 },
  { x: 87.096, y: 844, w: 9.956, h: 34, r: 9999 },
];

export const AGENDA_SEED: BoneLibrary = {
  768: { width: 848, height: 911, bones: BONES_768 },
};
