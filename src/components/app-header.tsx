import Link from "next/link";

import { Box, Container, Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { GuestMenu } from "@/components/guest-menu";
import { ProfileMenu } from "@/components/profile-menu";
import { BRAND_NAME } from "@/config/brand";
import { ROUTES } from "@/config/routes";
import type { Organizer } from "@/lib/organizer";
import type { Theme } from "@/lib/preferences";

/**
 * The bar every page starts with: the wordmark on the left, you on the right.
 *
 * It exists so those two things stop being re-invented per page. Before this,
 * each screen had its own arrangement of a name, an avatar, a language switcher
 * and a back link, and they had drifted into looking like several products —
 * `/new` opened with an underlined "Back", `/e/…` with a bare language toggle,
 * `/my-events` with a header this one grew out of.
 *
 * The right-hand control is the same capsule either way: the account menu when
 * there is a session, {@link GuestMenu} when there is not. Same size, same
 * shape, so the bar does not reflow the moment someone signs in.
 *
 * The wordmark goes to `/my-events` for an account holder and `/` for everyone
 * else, because that is what "home" means to each of them — `/` only redirects
 * to `/my-events` for a session anyway.
 *
 * Full-bleed by design: the border runs edge to edge while the contents line up
 * with the page's own container, which is what stops the rule from looking like
 * it belongs to the card underneath it.
 */
export function AppHeader({
  organizer,
  theme,
  /** Where to come back to after signing in. Ignored when signed in. */
  signInNext,
}: {
  organizer: Organizer | null;
  theme: Theme | null;
  signInNext?: string;
}) {
  return (
    <Box as="header" borderBottom="1px solid var(--sm-border-default)">
      <Container size="1" px="4">
        <Flex justify="between" align="center" gap="3" py="3">
          {/*
            Link on the outside, Text within — NOT `<Text as={Link}>`.
            @stackmyth/text is a client component, and handing a client
            component another component as a prop means passing a function
            across the server boundary, which React refuses at render time.
            Nesting is the shape that works: the anchor is the real link and
            Text only styles what is inside it.

            `variant="h4"` for the size, `as="span"` for the semantics — the
            page's own <h1> is the heading, and a wordmark that also claimed
            one would give every screen two.

            The `brand-link` class neutralises next/link's anchor underline.
            It cannot be done from the Text inside: `text-decoration` set by an
            ancestor is inherited as a drawn line, and a descendant declaring
            `none` does not remove it — that is a CSS rule, not an oversight.
            Overriding a third-party component's own default is one of the
            sanctioned reasons for app CSS.
          */}
          <Link href={organizer ? ROUTES.myEvents : ROUTES.home} className="brand-link">
            <Text as="span" variant="h4" weight="bold" color="default">
              {BRAND_NAME}
            </Text>
          </Link>

          {organizer ? (
            <ProfileMenu organizer={organizer} theme={theme} />
          ) : (
            <GuestMenu theme={theme} next={signInNext} />
          )}
        </Flex>
      </Container>
    </Box>
  );
}
