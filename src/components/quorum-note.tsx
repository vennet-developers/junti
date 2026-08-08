import { CheckCircleIcon, TriangleAlertIcon } from "@stackmyth/icons";
import { Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";
import { quorumOf } from "@/domain/quorum";

/**
 * "Faltan 4 personas para el mínimo" — the stated floor, measured.
 *
 * One component for both pages, because the organizer deciding whether to go
 * ahead and the participant deciding whether to bother are reading the same
 * number, and two copies of this sentence would eventually disagree. Renders
 * nothing when no minimum was stated: there is no fact to report, and an
 * "unset" line would be the app asking for a field the organizer declined.
 *
 * A note, never a warning banner. Being short of quorum is normal on the day
 * the link goes out, and shouting about it at that moment would make every
 * new event open in a state of alarm. The organizer's controls are one
 * column away; nothing here decides anything.
 */
export function QuorumNote({
  attendingUnits,
  minAttendees,
  copy,
}: {
  /** Seats, not rows — guests count toward the floor. */
  attendingUnits: number;
  minAttendees: number | null;
  copy: Copy;
}) {
  const quorum = quorumOf(attendingUnits, minAttendees);
  if (quorum.state === "unset") return null;

  const met = quorum.state === "met";

  return (
    <Flex gap="2" align="center">
      {met ? (
        <CheckCircleIcon size={16} aria-hidden="true" />
      ) : (
        <TriangleAlertIcon size={16} aria-hidden="true" />
      )}
      <Text variant="small" color="muted">
        {met ? copy.manage.quorumMet(quorum.minimum) : copy.manage.quorumShort(quorum.missing)}
      </Text>
    </Flex>
  );
}
