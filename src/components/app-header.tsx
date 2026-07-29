import Link from "next/link";

import { Box, Container, Flex } from "@stackmyth/layout";

import { Chapa } from "@/components/chapa";
import { GuestMenu } from "@/components/guest-menu";
import { ProfileMenu } from "@/components/profile-menu";
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
            The chapa is the logo, and this is the one place it appears — the
            brand allows a single chapa per screen.

            The `brand-link` class neutralises next/link's anchor underline. It
            cannot be done from inside: `text-decoration` set by an ancestor is
            drawn across its descendants, and a child declaring `none` does not
            remove it — that is a CSS rule, not an oversight. An underline
            crossing the badge would read as a mistake.

            `chapa-slot` reserves the height the rotated badge actually
            occupies. A rotated box overflows its layout box, and without the
            reservation the corners of the chapa reach past the header's own
            rule.
          */}
          {/* No aria-label: the chapa renders the word "junti." as real text,
              so the link already has an accessible name. */}
          <Link href={organizer ? ROUTES.myEvents : ROUTES.home} className="brand-link chapa-slot">
            <Chapa />
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
