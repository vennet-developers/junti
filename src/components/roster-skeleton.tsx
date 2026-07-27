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
 * Composed entirely from Stackmyth primitives; every dimension is a token.
 */
export function RosterSkeleton() {
  return (
    <Container size="1">
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
