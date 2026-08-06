import type { ReactNode } from "react";

import { Badge } from "@stackmyth/badge";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { List, ListItem } from "@stackmyth/list-item";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";
import { formatMoney } from "@/lib/format";
import type { ParticipantRosterMember } from "@/lib/roster";

import { PaymentBadge } from "./payment-badge";
import { PersonAvatar } from "./person-avatar";

export interface RosterGroupProps {
  title: string;
  members: ParticipantRosterMember[];
  currency: string;
  copy: Copy;
  /** Money is hidden entirely when the event has no cost. */
  showMoney: boolean;
  /** Position number, shown for the waitlist so people know where they stand. */
  numbered?: boolean;
  /**
   * Drop the group's own heading and count.
   *
   * For a group inside a disclosure that already names it: the panel said
   * "Falta un requisito (1)" and the list under it repeated "FALTA UN
   * REQUISITO 1", which reads as two groups until you notice it is one.
   */
  showHeading?: boolean;
  /**
   * How loud the heading is.
   *
   * `section` matches the money summary beside it — this group IS the section,
   * as on the organizer's page. `label` is the quieter uppercase caption, for
   * a group that sits *under* a heading of its own: the participant page
   * already says "Quién viene" above these, and two lines of the same size
   * saying nearly the same thing is not a hierarchy.
   */
  headingSize?: "section" | "label";
  /** Organizer-only controls, rendered per member. */
  renderActions?: (member: ParticipantRosterMember) => ReactNode;
  /** A line under the name — what a pending participant is still waiting on. */
  renderNote?: (member: ParticipantRosterMember) => ReactNode;
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
  showHeading = true,
  headingSize = "section",
  renderActions,
  renderNote,
}: RosterGroupProps) {
  return (
    <Stack gap="3">
      {/*
        Titled like the money section beside it, because it is the same rank of
        thing: "Cuentas" and "Vienen" are the two halves of what an organizer
        opens this page for. It used to be a small uppercase label in muted
        grey with the count floating loose at the far end of the row — which at
        eight rows read as a caption belonging to the list above it rather than
        a heading for the list below, and left the number looking dropped.

        The count goes in a pill so it is an object with an edge instead of a
        digit adrift in the whitespace. Deliberately NOT `junti-chapita`: a
        sticker in this app means a state somebody is in, and this is a
        quantity.
      */}
      {showHeading ? (
        <Flex justify="between" align="center" gap="3">
          {headingSize === "section" ? (
            <Text variant="h3" fontFamily="var(--junti-display)">
              {title}
            </Text>
          ) : (
            <Text variant="small" weight="semibold" textTransform="uppercase" color="muted">
              {title}
            </Text>
          )}
          <Badge variant="secondary" size={headingSize === "section" ? "md" : "sm"} soft>
            {members.length}
          </Badge>
        </Flex>
      ) : null}

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
              <ListItem key={member.id} className="junti-fila-roster">
                <Stack gap="2" width="100%">
                  {/* Identity + status: one line, name allowed to shrink. */}
                  <Flex justify="between" align="start" gap="3">
                    <Box minWidth="0">
                      <Flex gap="2" align="start">
                        {numbered ? (
                          /* Box for flexShrink — Text has no LayoutProps (gap #8). */
                          <Box flexShrink={0}>
                            <Text as="span" variant="small" color="muted">
                              {index + 1}.
                            </Text>
                          </Box>
                        ) : null}

                        {/* Everyone gets a disc: the photo when there is one,
                            their initials when there is not. This used to be
                            photo-or-nothing, on the reasoning that initials
                            would imply an account somebody may not have — but
                            a half-filled column of faces reads as a rendering
                            fault, not as a fact about accounts, and the
                            initials are seeded to the same colour the person
                            already has on their event card. */}
                        <Box flexShrink={0}>
                          <PersonAvatar
                            src={member.avatarUrl}
                            name={member.displayName}
                            size="sm"
                          />
                        </Box>

                        {/*
                          Name and note in one column, so the note lines up
                          under the name rather than under the avatar. It used
                          to sit outside this block and start at the row's left
                          edge, which read as a caption for the whole row
                          instead of as something this person said.
                        */}
                        <Box minWidth="0">
                          <Stack gap="1">
                            <Text weight="medium">{member.displayName}</Text>
                            {/* The seats this person answers for, by name.
                                Names only — the claim links live in the
                                sponsor's own panel, never on the shared
                                roster. */}
                            {member.guests.length > 0 ? (
                              <Text variant="small" color="muted">
                                {copy.heldSpots.broughtBy(
                                  member.guests.map((guest) => guest.name).join(", "),
                                )}
                              </Text>
                            ) : null}
                            {note}
                          </Stack>
                        </Box>
                      </Flex>
                    </Box>

                    {/* `share` is null for a reader with no session — the
                        amounts are never sent, so there is nothing to hide
                        here. See `toParticipantView`. */}
                    <Flex gap="2" align="center" flexShrink={0}>
                      {showMoney && member.share?.owes ? (
                        <Text variant="small" color="muted" whiteSpace="nowrap">
                          {formatMoney(
                            member.share.effectiveAmountMinor,
                            currency,
                            copy.intlLocale,
                          )}
                        </Text>
                      ) : null}
                      {showMoney && member.share?.owes ? (
                        <PaymentBadge status={member.share.status} copy={copy} compact />
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
            );
          })}
        </List>
      )}
    </Stack>
  );
}
