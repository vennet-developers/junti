import { Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";

/**
 * Placeholder shown while an event page is fetched.
 *
 * Both event routes are server-rendered on demand and hit the database, so on
 * Colombian mobile data there is a real gap before anything appears. This
 * mirrors the true page shape — header, money summary, roster rows — so the
 * layout does not jump when the content lands.
 *
 * **Two pages, two widths, so the width is an argument.** This is the fallback
 * for the participant page and for the organizer console, and those used to be
 * the same 448px column. They are not any more: the participant page reads at
 * `size="2"` and the console runs to `size="4"` with a second column. A single
 * hardcoded width cannot be right for both, and being wrong for one of them is
 * exactly the jump this component exists to prevent — so each route says which
 * page it is standing in for.
 *
 * The shape stays one column either way. Drawing the console's aside here would
 * mean maintaining a third copy of that layout for the second somebody rearranges
 * it, and a fallback that is honestly plainer costs less than one that is
 * elaborately out of date.
 *
 * Composed entirely from Stackmyth primitives; every dimension is a token.
 */
export function RosterSkeleton({
  /** Match the page this stands in for — see the note above. */
  size = "2",
}: {
  size?: "2" | "4";
}) {
  return (
    <Container size={size}>
      <Stack gap="6" py="6" px="4" aria-hidden="true">
        {/* Header: kind badge, title, three detail rows. */}
        <Stack gap="3">
          <Skeleton width="72px" height="22px" borderRadius="var(--sm-radius-lg)" />
          <Skeleton width="80%" height="34px" borderRadius="var(--sm-radius-md)" />
          <Stack gap="3">
            {[0, 1, 2].map((row) => (
              <Flex key={row} gap="3" align="center">
                <Skeleton width="18px" height="18px" borderRadius="var(--sm-radius-sm)" />
                <Skeleton width="60%" height="18px" borderRadius="var(--sm-radius-sm)" />
              </Flex>
            ))}
          </Stack>
        </Stack>

        <Divider />

        {/* Money summary: two stats and the progress bar. */}
        <Stack gap="3">
          <Skeleton width="40%" height="24px" borderRadius="var(--sm-radius-md)" />
          <Flex gap="5" wrap="wrap">
            <Skeleton width="130px" height="44px" borderRadius="var(--sm-radius-md)" />
            <Skeleton width="130px" height="44px" borderRadius="var(--sm-radius-md)" />
          </Flex>
          <Skeleton width="100%" height="8px" borderRadius="var(--sm-radius-lg)" />
        </Stack>

        <Divider />

        {/* Roster rows. */}
        <Stack gap="3">
          <Skeleton width="45%" height="24px" borderRadius="var(--sm-radius-md)" />
          {[0, 1, 2, 3, 4].map((row) => (
            <Flex key={row} justify="between" align="center" gap="3">
              <Skeleton width="45%" height="18px" borderRadius="var(--sm-radius-sm)" />
              <Skeleton width="64px" height="20px" borderRadius="var(--sm-radius-lg)" />
            </Flex>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
