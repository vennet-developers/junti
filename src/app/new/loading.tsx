import { Container, Stack } from "@stackmyth/layout";
import { Skeleton } from "@stackmyth/skeleton";

/**
 * Placeholder while the create form is prepared.
 *
 * The form's kind picker and its confirmation policies come from the
 * catalogue tables, so the page cannot render until they arrive. Five field
 * blocks mirror the real form's rhythm without promising an exact count.
 */
export default function Loading() {
  return (
    <Container size="2" px="4" py="6">
      <Stack gap="6" aria-hidden="true">
        <Stack gap="2">
          <Skeleton width="55%" height="34px" borderRadius="var(--sm-radius-md)" />
          <Skeleton width="80%" height="18px" borderRadius="var(--sm-radius-sm)" />
        </Stack>

        <Skeleton width="100%" height="120px" borderRadius="var(--sm-radius-lg)" />

        {[0, 1, 2, 3, 4].map((field) => (
          <Stack key={field} gap="2">
            <Skeleton width="30%" height="16px" borderRadius="var(--sm-radius-sm)" />
            <Skeleton width="100%" height="45px" borderRadius="var(--sm-radius-md)" />
          </Stack>
        ))}

        <Skeleton width="100%" height="50px" borderRadius="var(--sm-radius-md)" />
      </Stack>
    </Container>
  );
}
