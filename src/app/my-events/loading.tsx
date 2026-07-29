import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";

/**
 * Placeholder while the event list is fetched.
 *
 * Shaped like the page it replaces — header bar, create action, search, tabs,
 * then cards — rather than a spinner, so the layout does not jump when the
 * content lands. The page queries the roster and the event-type catalogue, so
 * on mobile data there is a real gap to fill.
 */
export default function Loading() {
  return (
    <>
      <Box as="header" borderBottom="1px solid var(--sm-border-default)">
        <Container size="1" px="4">
          <Flex justify="between" align="center" gap="3" py="3">
            <Skeleton width="64px" height="28px" borderRadius="var(--sm-radius-md)" />
            <Skeleton width="145px" height="42px" borderRadius="var(--sm-radius-full)" />
          </Flex>
        </Container>
      </Box>

      <Container size="1" px="4" py="6">
        <Stack gap="5" aria-hidden="true">
          <Skeleton width="45%" height="30px" borderRadius="var(--sm-radius-md)" />
          <Skeleton width="100%" height="50px" borderRadius="var(--sm-radius-md)" />
          <Skeleton width="100%" height="45px" borderRadius="var(--sm-radius-md)" />
          <Skeleton width="100%" height="40px" borderRadius="var(--sm-radius-md)" />

          {/* Two cards: enough to read as a list without pretending to know
              how many events there are. */}
          <Stack gap="3" pt="1">
            {[0, 1].map((card) => (
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
          </Stack>
        </Stack>
      </Container>
    </>
  );
}
