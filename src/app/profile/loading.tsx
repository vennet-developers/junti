import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";

/**
 * Placeholder while the stored preferences are read.
 *
 * Two selects and a save button, in the shape they will land in — the page
 * reads the account's row before it can show which option is chosen.
 */
export default function Loading() {
  return (
    <>
      <Box as="header" borderBottom="1px solid var(--sm-border-default)">
        <Container size="4" px="4">
          <Flex justify="between" align="center" gap="3" py="3">
            <Skeleton width="64px" height="28px" borderRadius="var(--sm-radius-md)" />
            {/* Matches the real trigger's measured 144x51 — see the note in
                my-events/loading.tsx. */}
            <Skeleton width="145px" height="51px" borderRadius="var(--sm-radius-full)" />
          </Flex>
        </Container>
      </Box>

      <Container size="2" px="4" py="6">
        <Stack gap="6" aria-hidden="true">
          {/* The breadcrumb line, so the heading below does not jump up a row
              when the real trail arrives. */}
          <Skeleton width="150px" height="18px" borderRadius="var(--sm-radius-sm)" />

          <Stack gap="2">
            <Skeleton width="40%" height="30px" borderRadius="var(--sm-radius-md)" />
            <Skeleton width="75%" height="18px" borderRadius="var(--sm-radius-sm)" />
          </Stack>

          {[0, 1].map((field) => (
            <Stack key={field} gap="2">
              <Skeleton width="25%" height="16px" borderRadius="var(--sm-radius-sm)" />
              <Skeleton width="100%" height="45px" borderRadius="var(--sm-radius-md)" />
            </Stack>
          ))}

          <Skeleton width="100%" height="50px" borderRadius="var(--sm-radius-md)" />
        </Stack>
      </Container>
    </>
  );
}
