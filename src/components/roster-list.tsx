import type { ReactNode } from "react";

import { Box, Flex, Stack } from "@stackmyth/layout";
import { List, ListItem } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";
import { formatMoney } from "@/lib/format";
import type { RosterMember } from "@/lib/roster";

import { PaymentBadge } from "./payment-badge";
import { PersonAvatar } from "./person-avatar";

export interface RosterGroupProps {
  title: string;
  members: RosterMember[];
  currency: string;
  copy: Copy;
  /** Money is hidden entirely when the event has no cost. */
  showMoney: boolean;
  /** Position number, shown for the waitlist so people know where they stand. */
  numbered?: boolean;
  /** Organizer-only controls, rendered per member. */
  renderActions?: (member: RosterMember) => ReactNode;
  /** A line under the name — what a pending participant is still waiting on. */
  renderNote?: (member: RosterMember) => ReactNode;
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
  copy,
  showMoney,
  numbered = false,
  renderActions,
  renderNote,
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
        /*
          Dividers stay here, unlike the landing page: these rows carry a name,
          an amount and a sticker each, and the rule is what keeps a long list
          scannable.

          Nothing else is needed to keep the rule straight. The separator is a
          border-top on the row, and a border follows the corner radius of the
          box it sits on — which bent it visibly at this brand's 13px. 0.24.3
          clears the row's leading corners inside the library, so a local class
          squaring them here would only be restating what the component now
          does.
        */
        <List as="ul" divided>
          {members.map((member, index) => {
            const note = renderNote?.(member);

            return (
              <ListItem key={member.id}>
                <Stack gap="2" width="100%">
                  {/* Identity + status: one line, name allowed to shrink. */}
                  <Flex justify="between" align="center" gap="3">
                    <Box minWidth="0">
                      <Flex gap="2" align="center">
                        {numbered ? (
                          /* Box for flexShrink — Text has no LayoutProps (gap #8). */
                          <Box flexShrink={0}>
                            <Text as="span" variant="small" color="muted">
                              {index + 1}.
                            </Text>
                          </Box>
                        ) : null}

                        {/* Only signed-in participants have one. Everyone else
                            keeps the plain name they always had — no initials
                            placeholder, which would imply an account. */}
                        {member.avatarUrl ? (
                          <Box flexShrink={0}>
                            <PersonAvatar
                              src={member.avatarUrl}
                              name={member.displayName}
                              size="sm"
                            />
                          </Box>
                        ) : null}

                        <Text weight="medium">{member.displayName}</Text>
                      </Flex>
                    </Box>

                    <Flex gap="2" align="center" flexShrink={0}>
                      {showMoney && member.share.owes ? (
                        <Text variant="small" color="muted" whiteSpace="nowrap">
                          {formatMoney(
                            member.share.effectiveAmountMinor,
                            currency,
                            copy.intlLocale,
                          )}
                        </Text>
                      ) : null}
                      {showMoney && member.share.owes ? (
                        <PaymentBadge status={member.share.status} copy={copy} />
                      ) : null}
                    </Flex>
                  </Flex>

                  {note ? <Box>{note}</Box> : null}

                  {/* Controls get the full width of the row. */}
                  {renderActions ? (
                    <Flex gap="2" wrap="wrap" align="center">
                      {renderActions(member)}
                    </Flex>
                  ) : null}
                </Stack>
              </ListItem>
            );
          })}
        </List>
      )}
    </Stack>
  );
}
