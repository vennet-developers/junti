import { Text } from "@stackmyth/text";

import { BRAND_NAME } from "@/config/brand";

/**
 * The logo.
 *
 * There is no separate symbol in this identity: the logo is the product's name
 * inside a leaning orange badge, closed by a full stop that means "ya está".
 * So this renders text, not an image — see brand-marks.css for why.
 *
 * `size` is a font-size, and the whole mark is built from it in `em`: the badge
 * grows, its corner radius stays proportional, the air inside it holds. One
 * number moves the entire construction.
 *
 * **One chapa per screen.** A brand rule with a "no hacer" beside it, and the
 * reason the header is the only caller: two badges on one screen and neither
 * reads as the logo. Anywhere else that needs the brand small — a favicon, an
 * avatar, anything under 20px tall — takes the "j." monogram instead, which is
 * what {@link Monograma} is for.
 */
export function Chapa({ size = "1.25rem" }: { size?: string }) {
  return (
    /*
      `fontSize` is a Text prop, not a `style=` — the component turns its own
      props into styles, which is the sanctioned way to vary one. The class
      carries only what no prop can express: the rotation, the badge, the air.

      The name and the dot are separate elements because the dot is cream on
      orange while the letters are ink, and the kit forbids ever letting the dot
      take the letters' colour.
    */
    <Text
      as="span"
      className="junti-chapa"
      fontSize={size}
      /*
        The logo is lowercase. "Mayúscula inicial" is on the brand's list of
        things not to do, and BRAND_NAME is "Junti" because that is how the
        name is written in prose — titles, metadata, a sentence. Transforming
        here keeps both true from one constant.
      */
      textTransform="lowercase"
    >
      {BRAND_NAME}
      <Text as="span" className="junti-chapa__punto">
        .
      </Text>
    </Text>
  );
}

/**
 * The "j." monogram, for anywhere the full chapa would fall under 20px.
 *
 * Same rule as the chapa about the dot: separate, cream, never muted.
 */
export function Monograma({ size = "1rem" }: { size?: string }) {
  return (
    <Text as="span" className="junti-chapa" fontSize={size} textTransform="lowercase">
      j
      <Text as="span" className="junti-chapa__punto">
        .
      </Text>
    </Text>
  );
}
