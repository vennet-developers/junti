import { Avatar, AvatarFallback, AvatarGroup } from "@stackmyth/avatar";
import { Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

/**
 * The overlapping faces on an event card.
 *
 * Participants have no photos and no accounts — they type a name into a
 * WhatsApp link and that is all we ever know about them — so the stack is
 * initials. To stop it reading as a row of identical grey discs, each name gets
 * a colour derived from the name itself, which means the same person keeps the
 * same colour across every event and across reloads without anything being
 * stored.
 */

/**
 * How many colours the palette offers.
 *
 * The colours themselves live in globals.css as `.attendee-avatar--1…6`, each
 * setting the two custom properties the Avatar reads — its background and its
 * fallback text. They belong there rather than here because Stackmyth
 * components take their appearance from props and tokens, never from `style=`,
 * and a class can carry a token pair that an inline colour cannot.
 */
const PALETTE_SIZE = 6;

/**
 * FNV-1a, 32-bit. Any stable hash would do — this one is short, has no
 * dependencies and spreads short strings well, which is what a first name is.
 */
function paletteClassFor(name: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `attendee-avatar--${(hash % PALETTE_SIZE) + 1}`;
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

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
          <Avatar key={`${name}-${index}`} size="sm" bordered className={paletteClassFor(name)}>
            <AvatarFallback>{initialsOf(name)}</AvatarFallback>
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
