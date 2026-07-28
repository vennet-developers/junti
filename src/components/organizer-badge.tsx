import { Avatar, AvatarFallback, AvatarImage } from "@stackmyth/avatar";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import type { Organizer } from "@/lib/organizer";

/**
 * The signed-in organizer: photo, name, email.
 *
 * The Google profile photo is the reason accounts exist at all, so it leads.
 * Email sign-ins have no photo, and `AvatarFallback` covers that with initials
 * rather than a broken image.
 */
export function OrganizerBadge({ organizer }: { organizer: Organizer }) {
  const initials = organizer.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Flex gap="3" align="center">
      <Box flexShrink={0}>
        <Avatar size="lg">
          {/* AvatarImage removes itself if the URL fails, so the fallback shows. */}
          {organizer.avatarUrl ? (
            <AvatarImage src={organizer.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback>{initials || "?"}</AvatarFallback>
        </Avatar>
      </Box>

      <Box minWidth="0">
        <Stack gap="0">
          <Text weight="semibold">{organizer.displayName}</Text>
          {organizer.email ? (
            <Text variant="small" color="muted">
              {organizer.email}
            </Text>
          ) : null}
        </Stack>
      </Box>
    </Flex>
  );
}
