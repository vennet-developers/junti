import type { ReactNode } from "react";

import { Flex, Stack } from "@stackmyth/layout";
import {
  List,
  ListItem,
  ListItemAction,
  ListItemContent,
  ListItemTitle,
} from "@stackmyth/list-item";
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
        <Text variant="h3">{title}</Text>
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
              <ListItemContent>
                <Flex gap="2" align="center" wrap="wrap">
                  {numbered ? (
                    <Text as="span" variant="small" color="muted">
                      {index + 1}.
                    </Text>
                  ) : null}
                  <ListItemTitle>{member.displayName}</ListItemTitle>
                </Flex>
                {showMoney && member.share.owes ? (
                  <Text variant="small" color="muted">
                    {copy.money.owesLabel}{" "}
                    {formatMoney(member.share.effectiveAmountMinor, currency)}
                  </Text>
                ) : null}
              </ListItemContent>

              <ListItemAction>
                <Flex gap="2" align="center" wrap="wrap" justify="end">
                  {showMoney && member.share.owes ? (
                    <PaymentBadge status={member.share.status} />
                  ) : null}
                  {renderActions?.(member)}
                </Flex>
              </ListItemAction>
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}
