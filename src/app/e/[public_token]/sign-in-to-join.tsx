import Link from "next/link";

import { Button } from "@stackmyth/button";
import { Card, CardContent } from "@stackmyth/card";
import { SparklesIcon } from "@stackmyth/icons";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { PersonAvatar } from "@/components/person-avatar";
import type { Copy } from "@/config/copy";
import { signInPath } from "@/config/routes";
import { participantPath } from "@/lib/urls";

/** How many faces before it stops being a group and starts being a crowd. */
const FACES_SHOWN = 5;

export interface SignInToJoinProps {
  publicToken: string;
  copy: Copy;
  eventTitle: string;
  /** Everyone confirmed, in roster order. Only the first few are drawn. */
  attending: { id: string; displayName: string; avatarUrl: string | null }[];
}

/**
 * What stands where the RSVP box goes, for a reader with no session.
 *
 * The event itself is never hidden behind this: the title, the time, the cost
 * and the whole roster render above it exactly as they do for anyone else. Only
 * the act of answering needs an account, so only the answer is gated. Somebody
 * arriving from a WhatsApp link can still decide whether they care before being
 * asked for anything, which is the difference between a card and a wall.
 *
 * **The proof is the actual roster, not testimonials.** The pattern this is
 * modelled on ends with photographs of famous strangers vouching for the
 * product; that works for a publication and would be a lie here. What makes
 * somebody join this event is that their friends already have, and we know
 * exactly who those people are — so the faces at the bottom are real, they are
 * from this event, and they cost nothing to keep honest.
 *
 * The block disappears when nobody has answered yet. An empty proof is worse
 * than none: "be the first" is a reason to wait, not a reason to join.
 */
export function SignInToJoin({ publicToken, copy, eventTitle, attending }: SignInToJoinProps) {
  const faces = attending.slice(0, FACES_SHOWN);
  const remaining = attending.length - faces.length;

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="5">
          <Stack gap="2">
            <Text variant="h3" fontFamily="var(--junti-display)">
              {copy.rsvp.signInHeading(eventTitle)}
            </Text>
            <Text variant="small" color="muted">
              {copy.rsvp.signInHelp}
            </Text>
          </Stack>

          <Stack gap="3" role="list">
            {copy.rsvp.signInBenefits.map((benefit) => (
              <Flex key={benefit} gap="3" align="start" role="listitem">
                {/* flexShrink so the mark keeps its width when the line wraps
                    at 390px — the same fix the Notice icon needed. */}
                <Box flexShrink={0} color="var(--junti-naranja)">
                  <SparklesIcon size={16} aria-hidden="true" />
                </Box>
                <Text variant="small">{benefit}</Text>
              </Flex>
            ))}
          </Stack>

          <Button asChild size="lg" fullWidth>
            <Link href={signInPath(participantPath(publicToken))}>{copy.rsvp.signInCta}</Link>
          </Button>

          {faces.length > 0 ? (
            <>
              <Divider />
              <Stack gap="3">
                <Text variant="small" color="muted">
                  {copy.rsvp.signInAlreadyIn}
                </Text>
                <Flex gap="3" align="center" wrap="wrap">
                  {faces.map((member) => (
                    <Flex key={member.id} gap="2" align="center">
                      <PersonAvatar src={member.avatarUrl} name={member.displayName} size="sm" />
                      <Text variant="small">{member.displayName}</Text>
                    </Flex>
                  ))}
                  {remaining > 0 ? (
                    <Text variant="small" color="muted">
                      {copy.rsvp.signInAndMore(remaining)}
                    </Text>
                  ) : null}
                </Flex>
              </Stack>
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
