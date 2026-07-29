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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@stackmyth/dropdown-menu";
import {
  CalendarIcon,
  ChevronDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "@stackmyth/icons";
import { Box, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Toggle, ToggleGroup } from "@stackmyth/toggle";

import { useCopy } from "@/components/copy-provider";
import { ROUTES } from "@/config/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { setTheme } from "@/lib/theme-actions";

/**
 * The account menu: who you are, where you can go, how it should look.
 *
 * Four entries and no more. An earlier version also carried the language
 * choice, which put six tappable things and three headings behind a photo — it
 * read like a settings page that had escaped. Language lives on `/profile`,
 * beside the timezone, which is the screen for preferences that need
 * explaining. The menu keeps only what you want on the way somewhere else.
 *
 * Appearance is the exception that earns its place: it is a look-at-it-now
 * choice, so it stays, as one row of three rather than a list of radios.
 */
export function ProfileMenu({
  organizer,
  theme,
}: {
  organizer: { displayName: string; email: string | null; avatarUrl: string | null };
  /** The forced appearance, or null when following the operating system. */
  theme: "light" | "dark" | null;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initials =
    organizer.displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  function chooseTheme(next: string) {
    // ToggleGroup reports "" when the pressed item is pressed again. That is a
    // deselect, and there is no such state here — one of the three is always in
    // force — so ignore it rather than silently falling back to "system".
    if (!next) return;

    // "system" is this menu's word for "no stored preference". The server
    // stores null, and null is what lets `prefers-color-scheme` take over.
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
          size="md"
          aria-label={copy.auth.menuLabel}
          /*
            A capsule with a circular avatar has to be padded on purpose. The
            button's own horizontal padding is sized for text, so leaving it
            alone pressed the avatar flush against the rounded end.

            4px on the left, top and bottom sets the 32px avatar concentric
            inside the 40px pill — the circle sits IN the capsule's end rather
            than against it. The right side is wider on purpose: a chevron is
            optically lighter than a photograph, so matching the number would
            read as tighter, not as symmetric.
          */
          style={{
            borderRadius: "var(--sm-radius-full)",
            padding: "var(--sm-space-1) var(--sm-space-3) var(--sm-space-1) var(--sm-space-1)",
          }}
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
            <Box display="flex" flexShrink={0} color="var(--sm-text-secondary)">
              <ChevronDownIcon size={16} aria-hidden="true" />
            </Box>
          </Flex>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" width="15rem">
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
          STACKMYTH-GAP: DropdownMenuItem renders a <div role="menuitem"> and
          exposes no `asChild`, so there is no anchor to hand an href to — even
          though DropdownMenuTrigger, one component away in the same package,
          does have it. A router push is the least-bad substitute; the cost is
          that cmd-click cannot open these in a new tab. The alternative,
          nesting an <a> inside the item, gives two overlapping click targets
          for one action. See STACKMYTH-GAPS.md #17.
        */}
        <DropdownMenuItem onSelect={() => router.push(ROUTES.myEvents)}>
          <Flex gap="2" align="center">
            <Box display="flex" flexShrink={0}>
              <CalendarIcon size={16} aria-hidden="true" />
            </Box>
            {copy.auth.myEventsLink}
          </Flex>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => router.push(ROUTES.profile)}>
          <Flex gap="2" align="center">
            <Box display="flex" flexShrink={0}>
              <UserIcon size={16} aria-hidden="true" />
            </Box>
            {copy.profile.link}
          </Flex>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/*
          A segmented control rather than three radio rows: the choice is
          mutually exclusive, the options are short, and comparing them side by
          side is the whole point. The icon carries the meaning; the label is
          the accessible name and the visible one, which keeps it honest at
          390px.
        */}
        <Box px="2" py="2">
          <Stack gap="2">
            <Text variant="small" color="muted">
              {copy.appearance.label}
            </Text>
            <ToggleGroup
              type="single"
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
