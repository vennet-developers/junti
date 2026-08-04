import { Avatar, AvatarFallback, AvatarGroup } from "@stackmyth/avatar";
import { Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { avatarToneFor } from "@/lib/palette";

/**
 * The overlapping faces on an event card.
 *
 * Initials rather than photographs, even though participants have accounts now
 * and most carry a Google avatar. This stack draws the summary on an event
 * card, where the query returns names and a count and nothing else; loading
 * every attendee's photo to fill a 24px disc on a list of a dozen events is a
 * lot of bytes for very little. `PersonAvatar` is the one that shows the real
 * picture, where the person is actually the subject.
 *
 * To stop it reading as a row of identical grey discs, each name gets a colour
 * derived from the name itself, which means the same person keeps the same
 * colour across every event and across reloads without anything being stored.
 *
 * The initials come from `AvatarFallback name`. The copy that used to live
 * here indexed the string — `name[0]` — which returns a UTF-16 code unit
 * rather than a character and cut a name beginning with an emoji in half.
 */


export function AttendeeStack({
  names,
  total,
  emptyLabel,
  moreLabel,
}: {
  /** The first few attendees, already capped by the query. */
  names: string[];
  /** Everyone attending, which is what the "+N" is counted from. */
  total: number;
  emptyLabel: string;
  moreLabel: (n: number) => string;
}) {
  if (names.length === 0) {
    return (
      <Text variant="small" color="muted">
        {emptyLabel}
      </Text>
    );
  }

  const remaining = total - names.length;

  return (
    <Flex gap="2" align="center">
      <AvatarGroup>
        {names.map((name, index) => (
          // The name is the identity here, and two guests can share one. The
          // index keeps React's list keys unique without pretending otherwise.
          <Avatar key={`${name}-${index}`} size="sm" bordered tone={avatarToneFor(name)}>
            <AvatarFallback name={name} />
          </Avatar>
        ))}
      </AvatarGroup>

      {remaining > 0 ? (
        <Text variant="small" color="muted">
          {moreLabel(remaining)}
        </Text>
      ) : null}
    </Flex>
  );
}
