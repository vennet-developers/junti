import { Box, Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { getViewerCopy } from "@/lib/locale";

/**
 * Who made this, at the bottom of every page.
 *
 * **The wording is not a choice.** Vennet's brand manual prescribes one legal
 * line for the site and app footer — "© <year> Vennet SAS. <Product> is a
 * Vennet product. All rights reserved." — and names "a Vennet product" as
 * sanctioned voice against a "we never say" list of the usual agency words. So
 * this says exactly that, with Junti as the product and Vennet as the house:
 * the hierarchy was confirmed before anything was written, because shipping the
 * wrong one publicly is annoying to walk back.
 *
 * **The mark, not the wordmark.** Vennet ships both, and only the mark is real
 * artwork: the wordmark and the lockup are `<text>` elements asking for Outfit,
 * a face this app does not carry, so they would have painted in whatever the
 * device had lying around. The mark is one stroked curve — 222 bytes, no font
 * anywhere near it. Junti learned the same lesson about its own chapa and the
 * kit says it plainly: a logo must not need a font.
 *
 * The mark carries the link and the name; the sentence below repeats neither as
 * a link, which is what stops "Vennet" appearing three times in one footer.
 *
 * **Junti's palette for the type, Vennet's for the mark.** The attribution is a
 * credit on somebody else's page, not a co-brand — so the sentence uses this
 * app's muted text, the same pair every other muted line here is checked
 * against, while the mark keeps its own ink because a logo redrawn in the
 * host's colours is no longer the logo.
 *
 * **Static, at the end of the document.** Nothing floats or sticks, so on a
 * phone it cannot land on the button somebody is reaching for.
 */
export async function AppFooter() {
  const { copy } = await getViewerCopy();

  /*
    Rendered on the server, so the year is the server's rather than the
    reader's device clock — a phone with the wrong date cannot make the notice
    claim a different one.
  */
  const year = new Date().getFullYear();

  return (
    <Box as="footer" borderTop="1px solid var(--sm-border-default)" mt="7">
      <Container size="1" px="4">
        <Stack gap="4" py="6" align="center">
          {/*
            A plain <a> rather than next/link: it leaves the app entirely, and
            a client-side transition to another origin is not a thing.

            Plain <img> for the same reason the chapa is one: the optimizer is
            for photographs it can resize and re-encode, and this is 222 bytes
            of vector whose whole point is that one file renders at every size.
            The 120x27 viewBox sets the box, so nothing shifts while it loads.

            The two finishes and the swap between them live in brand-marks.css
            — the app's file for artwork no component can own. The alt is empty
            because the link already carries the name; announcing "Vennet"
            twice is how a logo link reads to a screen reader otherwise.
          */}
          <a
            href="https://vennet.dev"
            rel="noopener noreferrer"
            aria-label={copy.footer.vennetLabel}
            className="vennet-mark"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/vennet-mark-ink.svg"
              alt=""
              width={96}
              height={22}
              className="vennet-mark__art vennet-mark__art--light"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/vennet-mark-white.svg"
              alt=""
              width={96}
              height={22}
              className="vennet-mark__art vennet-mark__art--dark"
            />
          </a>

          <Text variant="small" color="muted" align="center">
            {copy.footer.legal(year)}
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
