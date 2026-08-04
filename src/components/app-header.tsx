import { Link } from "@tanstack/react-router";

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
 * **Rendered by the root layout, exactly like the footer, and for the same
 * reason.** It lived in each page for a while, and that placement had a cost
 * nobody chose on purpose: `loading.tsx` replaces the page segment, so during
 * every load the header vanished with it, and each skeleton had to carry a
 * hand-measured fake bar to hide the gap. In the layout it simply survives —
 * real during loads, never redrawn on navigation, impossible to forget on a
 * new screen. What made this possible was removing the one per-route prop
 * (`signInNext`): the guest menu now reads its return path from the router,
 * which knows the route better than any page prop did.
 *
 * The right-hand control is the same capsule either way: the account menu when
 * there is a session, {@link GuestMenu} when there is not. Same size, same
 * shape, so the bar does not reflow the moment someone signs in.
 *
 * The wordmark goes to `/my-events` for an account holder and `/` for everyone
 * else, because that is what "home" means to each of them — `/` only redirects
 * to `/my-events` for a session anyway.
 *
 * Full-bleed by design: the border runs edge to edge while the contents sit in
 * a container, which is what stops the rule from looking like it belongs to the
 * card underneath it.
 *
 * **That container is the app's frame, not the page's.** It used to be `size="1"`
 * to line up exactly with the page body beneath — which worked only because
 * every page in the app happened to be 448px. Once the console runs to 1136px
 * and a form stays at 448px, a bar that matched each one would change width from
 * screen to screen, and furniture that moves when you walk between rooms reads
 * as a bug. So it sits at the widest tier every page can reach and pages fit
 * inside it.
 */
export function AppHeader({
  organizer,
  theme,
}: {
  organizer: Organizer | null;
  theme: Theme | null;
}) {
  return (
    <Box as="header" borderBottom="1px solid var(--sm-border-default)">
      <Container size="4" px="4">
        <Flex justify="between" align="center" gap="3" py="3">
          {/*
            The chapa is the logo, and this is the one place it appears — the
            brand allows a single chapa per screen.

            88px wide. That clears the kit's 80px floor — below it the badge
            stops being legible and the "j" takes over — and lands the mark at
            51.3px tall, which is the account capsule's own height beside it.
            The two things in this bar are the same size on purpose.

            `brand-link` keeps the router link's anchor underline off it. That cannot
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
          <Link to={organizer ? ROUTES.myEvents : ROUTES.home} className="brand-link">
            <Chapa />
          </Link>

          {organizer ? (
            <ProfileMenu organizer={organizer} theme={theme} />
          ) : (
            <GuestMenu theme={theme} />
          )}
        </Flex>
      </Container>
    </Box>
  );
}
