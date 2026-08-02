import type { ReactNode } from "react";

import { Box } from "@stackmyth/layout";

/**
 * A slice of the page, fading out, with the sign-in card riding up onto it.
 *
 * The rest of the event does not disappear behind this — it dissolves. Somebody
 * arriving from a WhatsApp link can see there IS a roster and there ARE numbers
 * without being able to read them, which says something an empty page does not:
 * "this exists and it is for you". The title, the time and the place stay fully
 * legible above, so whether to bother is still answerable before signing in.
 *
 * **A fixed window, not the whole tail.** The preview is cut to a height rather
 * than left to run as long as the roster happens to be. Two reasons: a teaser
 * that scrolls is not a teaser, and the card has to overlap a KNOWN edge — laying
 * it over content of unpredictable height is how you get a card floating in the
 * middle of nothing on a short event and buried under names on a long one.
 *
 * **Three things make the faded half unreachable, not merely dim.** A mask is
 * paint; without the rest of this the names underneath would still be
 * selectable, still announced by a screen reader, and still focusable — somebody
 * tabbing through the page would disappear into content nobody can see. `inert`
 * takes it out of the tab order and the accessibility tree, `aria-hidden` is the
 * belt to that suspenders for engines that do not support `inert` yet, and
 * `pointerEvents` stops the strip above the card from swallowing a tap.
 */
export function GatedPreview({ card, children }: { card: ReactNode; children: ReactNode }) {
  return (
    <Box position="relative">
      <Box
        inert
        aria-hidden="true"
        pointerEvents="none"
        /*
          Taller once there is room for it.

          14rem is what a 390px screen can spare: the title, the time and the
          place have to stay above the fold, and on a phone that leaves almost
          nothing. A laptop has 900px of height and the same content occupies
          less of it, so the window can show more of what is being withheld —
          which is the whole mechanism. A teaser that reveals more is a better
          teaser, right up until it scrolls.

          The overlap in `.gated-preview__card` is derived from this number, so
          the two move together. Changing one alone breaks the seam.
        */
        height={{ base: "14rem", md: "18rem" }}
        overflow="hidden"
        /*
          Finishes at 70%, not at the bottom edge. A gradient that runs to 100%
          is still faintly painting where it gets clipped, which leaves a hard
          line exactly where the effect is meant to have already ended.
        */
        maskImage="linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.15) 40%, transparent 70%)"
      >
        {children}
      </Box>

      {/* The overlap itself is a negative margin, which is app CSS — see
          `.gated-preview__card` in globals.css for why it cannot be a prop. */}
      <Box className="gated-preview__card">{card}</Box>
    </Box>
  );
}
