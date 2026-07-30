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

            88px wide. That clears the kit's 80px floor — below it the badge
            stops being legible and the "j" takes over — and lands the mark at
            51.3px tall, which is the account capsule's own height beside it.
            The two things in this bar are the same size on purpose.

            `brand-link` keeps next/link's anchor underline off it. That cannot
            be done from inside: `text-decoration` set by an ancestor is drawn
            across its descendants, and a child declaring `none` does not remove
            it. An underline crossing the badge would read as a mistake.

            No height reservation any more. The mark used to be text rotated by
            CSS, which paints outside its layout box and reached past the
            header's rule; the kit's vector carries the rotation inside its own
            viewBox, so the box it occupies is the box it draws in.

            No aria-label either: the vector carries `role="img"` and
            `aria-label="junti."`, and the img's alt names the link.
          */}
          <Link href={organizer ? ROUTES.myEvents : ROUTES.home} className="brand-link">
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
