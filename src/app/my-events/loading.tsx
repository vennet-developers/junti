import { Box, Container, Flex, Grid, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";

/**
 * Placeholder while the event list is fetched.
 *
 * Shaped like the page it replaces — header bar, create action, search, tabs,
 * then cards — rather than a spinner, so the layout does not jump when the
 * content lands. The page queries the roster and the event-type catalogue, so
 * on mobile data there is a real gap to fill.
 *
 * **Every width here is a claim about the page underneath, so every width has
 * to move when that page does.** This claimed to prevent a jump while causing
 * one: the page went to `size="3"` with a two-column grid and this stayed at
 * `size="1"` in one column, so the skeleton drew a 448px ribbon and the content
 * landed 880px wide in two columns. A placeholder that lies about the layout is
 * worse than a spinner — a spinner at least does not promise a shape.
 *
 * That is the standing cost of hand-drawn skeletons and the reason to keep them
 * few: they are a second copy of the layout with nothing enforcing that the two
 * agree.
 */
export default function Loading() {
  return (
    <>
      <Box as="header" borderBottom="1px solid var(--sm-border-default)">
        {/* The shell's frame width — see `app-header.tsx`. */}
        <Container size="4" px="4">
          <Flex justify="between" align="center" gap="3" py="3">
            <Skeleton width="64px" height="28px" borderRadius="var(--sm-radius-md)" />
            {/* Measured against the real trigger, so the header does not
                resize when the menu replaces this: 144x51 at this app's
                density. The width assumes a two-word name and is the one
                number here that cannot be exact for everyone. */}
            <Skeleton width="145px" height="51px" borderRadius="var(--sm-radius-full)" />
          </Flex>
        </Container>
      </Box>

      <Container size="3" px="4" py="6">
        <Stack gap="5" aria-hidden="true">
          <Skeleton width="45%" height="30px" borderRadius="var(--sm-radius-md)" />

          {/*
            The create button, capped exactly where the real one is capped.

            `Skeleton`'s own `width` is a plain string — it is the one
            layout-ish component in the kit whose dimensions are not
            `Responsive<T>` — so the breakpoint lives on a wrapper instead. That
            works, and it is also the gap: a bone cannot state its own two
            widths, so every responsive bone needs a Box around it.
          */}
          <Box width="100%" maxWidth={{ base: "100%", md: "22rem" }}>
            <Skeleton width="100%" height="50px" borderRadius="var(--sm-radius-md)" />
          </Box>

          <Skeleton width="100%" height="45px" borderRadius="var(--sm-radius-md)" />
          <Skeleton width="100%" height="40px" borderRadius="var(--sm-radius-md)" />

          {/*
            Four cards in the same grid the list uses, not two in a column.
            Two filled one screen when the list was one column; in two columns
            they fill half of one, and a placeholder that stops half way up
            reads as content that finished loading short.
          */}
          <Grid columns={{ base: "1", md: "2" }} gap="3" pt="1">
            {[0, 1, 2, 3].map((card) => (
              <Stack key={card} gap="3" p="4" border borderRadius="var(--sm-radius-lg)">
                <Flex justify="between" align="start" gap="3">
                  <Stack gap="2" width="70%">
                    <Skeleton width="80%" height="20px" borderRadius="var(--sm-radius-sm)" />
                    <Skeleton width="60%" height="16px" borderRadius="var(--sm-radius-sm)" />
                  </Stack>
                  <Skeleton width="64px" height="22px" borderRadius="var(--sm-radius-lg)" />
                </Flex>
                <Flex gap="2" align="center">
                  {[0, 1, 2].map((avatar) => (
                    <Skeleton key={avatar} width="32px" height="32px" borderRadius="50%" />
                  ))}
                </Flex>
                <Skeleton width="50%" height="16px" borderRadius="var(--sm-radius-sm)" />
              </Stack>
            ))}
          </Grid>
        </Stack>
      </Container>
    </>
  );
}
