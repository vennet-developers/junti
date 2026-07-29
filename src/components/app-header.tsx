import Link from "next/link";

import { Box, Container, Flex } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { ProfileMenu } from "@/components/profile-menu";
import { BRAND_NAME } from "@/config/brand";
import { ROUTES } from "@/config/routes";
import type { Organizer } from "@/lib/organizer";
import type { Theme } from "@/lib/preferences";

/**
 * The bar every signed-in page starts with: the wordmark on the left, the
 * person on the right.
 *
 * It exists so those two things stop being re-invented per page. Before this,
 * `/my-events` and `/profile` each had their own arrangement of a name, an
 * avatar, a language switcher and a sign-out button, and they had drifted into
 * looking like two different products.
 *
 * The wordmark links to `/my-events` rather than `/`, because for somebody
 * signed in that IS home — `/` only redirects there anyway.
 *
 * Full-bleed by design: the border runs edge to edge while the contents line up
 * with the page's own container, which is what stops the rule from looking like
 * it belongs to the card underneath it.
 */
export function AppHeader({ organizer, theme }: { organizer: Organizer; theme: Theme | null }) {
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
          */}
          {/*
            The `brand-link` class neutralises next/link's anchor underline.
            It cannot be done from the Text inside: `text-decoration` set by an
            ancestor is inherited as a drawn line, and a descendant declaring
            `none` does not remove it — that is a CSS rule, not an oversight.
            Overriding a third-party component's own default is one of the
            sanctioned reasons for app CSS.
          */}
          <Link href={ROUTES.myEvents} className="brand-link">
            <Text as="span" variant="h4" weight="bold" color="default">
              {BRAND_NAME}
            </Text>
          </Link>

          <ProfileMenu organizer={organizer} theme={theme} />
        </Flex>
      </Container>
    </Box>
  );
}
