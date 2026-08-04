import { Box, Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";

/**
 * Who made this, at the bottom of every page.
 *
 * **"© <year> Junti by Vennet", and the same line in every email.** Shorter
 * than the legal line Vennet's manual prescribes for its own products — no
 * entity, no rights sentence, no domain — because this app lives at
 * junti.vennet.dev and a footer that spells out the company twice on a phone
 * is a footer nobody reads. The hierarchy it states is still the confirmed
 * one: Vennet the house, Junti the product.
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
 * **At the bottom of the viewport, without sticking to it.** The body is a
 * column at least a screen tall and a spacer above this eats whatever height a
 * short page leaves over, so the footer lands on the bottom edge instead of
 * floating half way up an empty screen. On a page taller than the screen there
 * is nothing left over, the spacer collapses, and its own top margin keeps it
 * off the content. Which is the difference from `position: fixed`: it never
 * covers the page, and on a phone it cannot land on the button somebody is
 * reaching for.
 */
export function AppFooter() {
  /*
    From the provider now, not from `getViewerCopy()`. Under Next this was an
    async server component and reading the cookie machinery directly was
    free; under TanStack the shell hydrates, so a footer importing the
    preferences module would drag the database client into the browser — the
    tripwire caught exactly that on this file's first render. The provider
    already holds the same resolved copy, one hop up.
  */
  const { copy } = useCopy();

  // Server-rendered on first paint, so the year the notice claims comes from
  // the server's clock; hydration re-runs it with the same value.
  const year = new Date().getFullYear();

  return (
    <Box as="footer" borderTop="1px solid var(--sm-border-default)" mt="7">
      {/*
        The same frame width as the header, for the same reason: the shell
        belongs to the app, not to whichever page is under it. Nothing moves
        visually — the contents are centred either way — but the two rules that
        bracket the page now agree with each other at every viewport.
      */}
      <Container size="4" px="4">
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
            <img
              src="/brand/vennet-mark-ink.svg"
              alt=""
              width={96}
              height={22}
              className="vennet-mark__art vennet-mark__art--light"
            />
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
