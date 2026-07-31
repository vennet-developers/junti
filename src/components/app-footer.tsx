import { Box, Container, Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { getViewerCopy } from "@/lib/locale";

/**
 * Who made this, at the bottom of every page.
 *
 * **The wording is not a choice.** Vennet's brand manual prescribes one legal
 * line for the site and app footer — "© <year> Vennet SAS. <Product> is a
 * Vennet product. All rights reserved." — and names "a Vennet product" as
 * sanctioned voice, against a "we never say" list of the usual agency words.
 * So this says exactly that, with Junti as the product and Vennet as the house:
 * the hierarchy was confirmed before anything was written, because shipping the
 * wrong one publicly is annoying to walk back.
 *
 * **Junti's palette, not Vennet's.** The attribution is a credit on somebody
 * else's page, not a co-brand: Vennet's cyan next to Junti's orange would read
 * as two products sharing a screen. It uses this app's muted text and its own
 * link treatment, which is also what keeps the contrast honest — the same pair
 * every other muted line on the page is checked against.
 *
 * **Static, at the end of the document.** Nothing here floats or sticks, so on
 * a phone it cannot land on the button somebody is reaching for; you meet it by
 * scrolling past everything the page was for.
 *
 * A real `<footer>` with a real anchor. `vennet.dev` is the house's own domain,
 * named in the manual, so the link goes somewhere rather than being decoration.
 */
export async function AppFooter() {
  const { copy } = await getViewerCopy();

  /*
    Rendered on the server, so the year is the server's rather than the
    reader's device clock — a phone with the wrong date cannot make the notice
    claim a different one. It is read at request time on the dynamic pages this
    app is made of.
  */
  const year = new Date().getFullYear();

  return (
    <Box as="footer" borderTop="1px solid var(--sm-border-default)" mt="7">
      <Container size="1" px="4">
        <Flex justify="center" py="5">
          <Text variant="small" color="muted" align="center">
            {copy.footer.legalBefore(year)}{" "}
            <Text as="a" variant="link" href="https://vennet.dev" rel="noopener noreferrer">
              {copy.footer.vennetLabel}
            </Text>
            {copy.footer.legalAfter}
          </Text>
        </Flex>
      </Container>
    </Box>
  );
}
