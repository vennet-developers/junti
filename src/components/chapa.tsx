import { BRAND_NAME } from "@/config/brand";

/**
 * The logo.
 *
 * There is no separate symbol in this identity: the logo is the product's name
 * inside a leaning orange badge, closed by a full stop that means "ya está".
 *
 * It is the brand kit's own vector, not text styled to look like it. That was
 * the earlier approach and the kit retired it — "el logo NO necesita la fuente:
 * ya está vectorizado". Two things come from the change:
 *
 *   · **No font dependency.** The wordmark IS the logo, and it used to wait on
 *     Bricolage Grotesque. With `font-display: swap` that means the most
 *     important element on the page painted in a fallback face first and then
 *     jumped. A vector paints with the first frame.
 *   · **The official geometry, exactly.** The rotation, the corner radius and
 *     the air inside the badge stop being numbers this app re-derives — which
 *     mattered, because the kit's prose and its artwork disagree about the
 *     corner radius (the README says 0.295 of the height; the SVG says 0.191).
 *     Shipping the artwork sidesteps the question.
 *
 * The glyphs are outlines, so nothing here depends on a font being installed
 * anywhere — in a browser, in Figma, or at a printer.
 */

/**
 * Below this the full badge stops being legible and the "j" takes over. The
 * kit sets the threshold on WIDTH: "hasta 79 px la j recortada; de 80 px de
 * ancho en adelante la chapa."
 */
export const CHAPA_MIN_WIDTH = 80;

/**
 * The full badge. `width` is the mark's rendered width — keep it at or above
 * {@link CHAPA_MIN_WIDTH}, and use {@link Monograma} below that.
 *
 * **One chapa per screen.** A brand rule with a "no hacer" beside it, and the
 * reason the header is the only caller: two badges on one screen and neither
 * reads as the logo.
 */
export function Chapa({ width = 88 }: { width?: number }) {
  /*
    A plain <img>, not next/image. The optimizer is for photographs it can
    resize and re-encode; this is a 3 KB vector whose whole point is that one
    file renders at every size, so routing it through would add a request and
    change nothing about the bytes.

    Width and height come from the kit's 302x176 viewBox, so the box is correct
    before the file arrives and nothing shifts around it while it loads.
  */
  return (
    <img
      src="/brand/junti-chapa-principal.svg"
      alt={BRAND_NAME}
      width={width}
      height={Math.round((width * 176) / 302)}
    />
  );
}

/**
 * The "j" monogram, for anywhere the full badge would fall under 80px wide.
 *
 * A separate mark rather than a shrunken chapa: the kit crops the j and its dot
 * out of the badge, with the stem running off the top edge.
 */
export function Monograma({ size = 32 }: { size?: number }) {
  return (
    <img src="/brand/junti-icono-app-naranja.svg" alt={BRAND_NAME} width={size} height={size} />
  );
}
