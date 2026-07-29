"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@stackmyth/avatar";
import { Button } from "@stackmyth/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@stackmyth/dropdown-menu";
// No sign-in glyph ships in the set — LogOutIcon has no counterpart — so the
// neutral arrow carries it. UserPlusIcon would have read as "create an
// account", which is a different offer.
import {
  ArrowRightIcon,
  ChevronDownIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Toggle, ToggleGroup } from "@stackmyth/toggle";

import { useCopy } from "@/components/copy-provider";
import { LOCALES, getCopy, type Locale } from "@/config/copy";
import { ROUTES, signInPath } from "@/config/routes";
import { setLocale } from "@/lib/locale-actions";
import { setTheme } from "@/lib/theme-actions";

/**
 * The header control for someone without an account.
 *
 * It is the same capsule as the signed-in one — same size, same shape, an
 * anonymous avatar where the photo goes — so the header keeps one silhouette
 * whether or not you are signed in, and the bar does not reflow when a session
 * appears.
 *
 * It is a menu rather than a plain "Sign in" link because language and
 * appearance used to live in the page body, above the heading, and the header
 * takes that spot now. Most people here never sign in at all — they opened a
 * WhatsApp link — so folding those two into a link would have taken the
 * language switch away from exactly the readers most likely to need it. Signing
 * in is still the first item and the only one with a full-width button.
 *
 * Language sits here and not on `/profile` (where it lives for account
 * holders), because a guest has no profile to go to.
 */
export function GuestMenu({
  theme,
  /** Where to return after signing in — the page the menu was opened from. */
  next,
}: {
  theme: "light" | "dark" | null;
  next?: string;
}) {
  const { copy, locale } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function chooseTheme(value: string) {
    // ToggleGroup reports "" when the pressed item is pressed again. One of the
    // three is always in force, so a deselect is not a state this has.
    if (!value) return;
    startTransition(() => void setTheme(value === "system" ? null : value));
  }

  function chooseLocale(value: string) {
    if (!value || value === locale) return;
    startTransition(() => void setLocale(value));
  }

  const appearances = [
    { value: "light", label: copy.appearance.light, icon: <SunIcon size={16} /> },
    { value: "dark", label: copy.appearance.dark, icon: <MoonIcon size={16} /> },
    { value: "system", label: copy.appearance.system, icon: <MonitorIcon size={16} /> },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          shape="pill"
          aria-label={copy.nav.guestMenuLabel}
        >
          <Avatar size="sm">
            {/*
              `delayMs={0}` because there is no image to wait for. The default
              600ms exists so a fallback does not flash while a photo loads —
              with no AvatarImage in the tree that timer only guarantees an
              empty circle for the first 600ms of every page load, and the
              fallback cannot render server-side at all until it elapses.
            */}
            <AvatarFallback delayMs={0}>
              <UserIcon size={16} aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <Text as="span" variant="small" weight="medium">
            {copy.nav.signIn}
          </Text>
          <Box display="flex" flexShrink={0} color="var(--sm-text-secondary)">
            <ChevronDownIcon size={16} aria-hidden="true" />
          </Box>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" width="15rem">
        {/*
          A menu item rather than a Button, so it keeps the roving focus and
          the type-ahead the rest of the menu has. The router push mirrors what
          the signed-in menu does with its links — see the STACKMYTH-GAP note
          in profile-menu.tsx for why these are not anchors.
        */}
        <DropdownMenuItem onSelect={() => router.push(signInPath(next ?? ROUTES.myEvents))}>
          <Flex gap="2" align="center">
            <Box display="flex" flexShrink={0}>
              <ArrowRightIcon size={16} aria-hidden="true" />
            </Box>
            {copy.nav.signIn}
          </Flex>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <Box px="2" py="2">
          <Stack gap="2">
            <Text variant="small" color="muted">
              {copy.common.language}
            </Text>
            {/*
              Each language names itself. "English" is legible to someone who
              cannot read the Spanish beside it, which a translated "Inglés"
              would not be — the same reasoning the standalone switcher used.
            */}
            <ToggleGroup
              type="single"
              variant="outline"
              value={locale}
              onValueChange={chooseLocale}
              size="sm"
              disabled={pending}
            >
              {LOCALES.map((option: Locale) => (
                <Toggle key={option} value={option}>
                  {getCopy(option).localeName}
                </Toggle>
              ))}
            </ToggleGroup>
          </Stack>
        </Box>

        <DropdownMenuSeparator />

        <Box px="2" py="2">
          <Stack gap="2">
            <Text variant="small" color="muted">
              {copy.appearance.label}
            </Text>
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme ?? "system"}
              onValueChange={chooseTheme}
              size="sm"
              disabled={pending}
            >
              {appearances.map((option) => (
                <Toggle key={option.value} value={option.value} aria-label={option.label}>
                  {option.icon}
                </Toggle>
              ))}
            </ToggleGroup>
          </Stack>
        </Box>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
