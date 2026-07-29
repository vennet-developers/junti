"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@stackmyth/avatar";
import { Button } from "@stackmyth/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@stackmyth/dropdown-menu";
import { ChevronDownIcon, LogOutIcon, UserIcon } from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { useCopy } from "@/components/copy-provider";
import { getCopy, LOCALES, type Locale } from "@/config/copy";
import { ROUTES } from "@/config/routes";
import { setLocale } from "@/lib/locale-actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { setTheme } from "@/lib/theme-actions";

/**
 * The signed-in organizer's photo and name, opening everything that is about
 * them rather than about an event.
 *
 * This replaced a row of four loose controls — a profile link, two language
 * buttons and a sign-out button — that competed with the page heading for
 * attention on a 390px screen. Collapsing them costs one tap and buys the
 * header back.
 *
 * `initials` is the fallback for email sign-ins, which have no photo.
 */
export function ProfileMenu({
  organizer,
  theme,
}: {
  organizer: { displayName: string; email: string | null; avatarUrl: string | null };
  /** The forced appearance, or null when following the operating system. */
  theme: "light" | "dark" | null;
}) {
  const { copy, locale } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initials =
    organizer.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  function chooseLocale(next: string) {
    if (next === locale) return;
    startTransition(() => void setLocale(next));
  }

  function chooseTheme(next: string) {
    // "system" is this menu's word for "no stored preference". The server
    // stores null, and null is what makes `prefers-color-scheme` take over.
    startTransition(() => void setTheme(next === "system" ? null : next));
  }

  function signOut() {
    startTransition(async () => {
      await createSupabaseBrowserClient().auth.signOut();
      // refresh() re-runs the server components so the session disappears
      // everywhere at once, not just on this page.
      router.refresh();
      router.push(ROUTES.home);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="md"
          aria-label={copy.auth.menuLabel}
          // Pill shape: the control is a person, and a rounded capsule reads as
          // one next to the square cards it sits above.
          style={{ borderRadius: "var(--sm-radius-full)", paddingLeft: "var(--sm-space-1)" }}
        >
          <Flex gap="2" align="center">
            <Avatar size="sm">
              {/* AvatarImage removes itself if the URL fails, so the fallback shows. */}
              {organizer.avatarUrl ? (
                <AvatarImage src={organizer.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <Text as="span" variant="small" weight="medium">
              {organizer.displayName}
            </Text>
            <ChevronDownIcon size={16} aria-hidden="true" />
          </Flex>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" width="16rem">
        <DropdownMenuLabel>
          <Stack gap="0">
            <Text variant="small" weight="semibold">
              {organizer.displayName}
            </Text>
            {organizer.email ? (
              <Text variant="small" color="muted">
                {organizer.email}
              </Text>
            ) : null}
          </Stack>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/*
          A router push rather than a <Link>: DropdownMenuItem renders a div and
          has no `asChild`, so there is no anchor to hand a href to. The cost is
          that cmd-click cannot open the profile in a new tab — acceptable for a
          menu entry, and the alternative (an anchor nested inside the item)
          gives two overlapping click targets for one action.
        */}
        <DropdownMenuItem onSelect={() => router.push(ROUTES.profile)}>
          <Flex gap="2" align="center">
            <Box display="flex" flexShrink={0}>
              <UserIcon size={16} aria-hidden="true" />
            </Box>
            {copy.profile.link}
          </Flex>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{copy.common.changeLanguage}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={chooseLocale}>
          {LOCALES.map((option) => (
            // Each language names itself: "English" is legible to someone who
            // cannot read the Spanish beside it, which "Inglés" would not be.
            <DropdownMenuRadioItem key={option} value={option} disabled={pending}>
              {getCopy(option as Locale).localeName}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{copy.appearance.label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={chooseTheme}>
          <DropdownMenuRadioItem value="light" disabled={pending}>
            {copy.appearance.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" disabled={pending}>
            {copy.appearance.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" disabled={pending}>
            {copy.appearance.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem destructive disabled={pending} onSelect={signOut}>
          <Flex gap="2" align="center">
            <Box display="flex" flexShrink={0}>
              <LogOutIcon size={16} aria-hidden="true" />
            </Box>
            {copy.auth.signOut}
          </Flex>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
