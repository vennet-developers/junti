import type { ReactNode } from "react";

import { Box, Flex, Stack } from "@stackmyth/layout";
import { List, ListItem } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import { copy } from "@/config/copy";
import { formatMoney } from "@/lib/format";
import type { RosterMember } from "@/lib/roster";

import { PaymentBadge } from "./payment-badge";

export interface RosterGroupProps {
  title: string;
  members: RosterMember[];
  currency: string;
  /** Money is hidden entirely when the event has no cost. */
  showMoney: boolean;
  /** Position number, shown for the waitlist so people know where they stand. */
  numbered?: boolean;
  /** Organizer-only controls, rendered per member. */
  renderActions?: (member: RosterMember) => ReactNode;
}

/**
 * One attendance group as a list.
 *
 * The row layout is deliberately NOT the `ListItemContent` / `ListItemAction`
 * side-by-side pattern. At 390px the organizer's controls need ~340px, which
 * squeezed the name column to literally zero width — and with `word-break`
 * inherited from the page, a squeezed column renders one character per line.
 * The name looked like a vertical ticker tape.
 *
 * So: identity on its own line, controls on the next, each full width. The
 * name gets `minWidth="0"` so it truncates or wraps normally rather than
 * forcing the row wider than the screen.
 */
export function RosterGroup({
  title,
  members,
  currency,
  showMoney,
  numbered = false,
  renderActions,
}: RosterGroupProps) {
  return (
    <Stack gap="2">
      <Flex justify="between" align="baseline" gap="2">
        <Text variant="small" weight="semibold" textTransform="uppercase" color="muted">
          {title}
        </Text>
        <Text variant="small" color="muted">
          {members.length}
        </Text>
      </Flex>

      {members.length === 0 ? (
        <Text variant="small" color="muted">
          {copy.roster.emptyGroup}
        </Text>
      ) : (
        <List as="ul" divided>
          {members.map((member, index) => (
            <ListItem key={member.id}>
              <Stack gap="2" width="100%">
                {/* Identity + status: one line, name allowed to shrink. */}
                <Flex justify="between" align="center" gap="3">
                  <Box minWidth="0">
                    <Flex gap="2" align="baseline">
                      {numbered ? (
                        /* Box for flexShrink — Text has no LayoutProps (gap #8). */
                        <Box flexShrink={0}>
                          <Text as="span" variant="small" color="muted">
                            {index + 1}.
                          </Text>
                        </Box>
                      ) : null}
                      <Text weight="medium">{member.displayName}</Text>
                    </Flex>
                  </Box>

                  <Flex gap="2" align="center" flexShrink={0}>
                    {showMoney && member.share.owes ? (
                      <Text variant="small" color="muted" whiteSpace="nowrap">
                        {formatMoney(member.share.effectiveAmountMinor, currency)}
                      </Text>
                    ) : null}
                    {showMoney && member.share.owes ? (
                      <PaymentBadge status={member.share.status} />
                    ) : null}
                  </Flex>
                </Flex>

                {/* Controls get the full width of the row. */}
                {renderActions ? (
                  <Flex gap="2" wrap="wrap" align="center">
                    {renderActions(member)}
                  </Flex>
                ) : null}
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}
