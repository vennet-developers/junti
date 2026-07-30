"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Avatar, AvatarFallback } from "@stackmyth/avatar";
import { Button } from "@stackmyth/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stackmyth/dialog";
import { ChevronDownIcon, MonitorIcon, MoonIcon, SunIcon, UserIcon, XIcon } from "@stackmyth/icons";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
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
 * The capsule is the same one the signed-in header shows — same size, same
 * shape, an anonymous avatar where the photo goes — so the bar keeps one
 * silhouette and does not reflow the moment a session appears.
 *
 * It opens a **drawer, not a menu**, and that is a correction rather than a
 * style choice. This panel holds two segmented controls, and a `role="menu"` is
 * for commands: a screen reader announcing "menu" and then finding a group of
 * radio-like toggles inside is being told the wrong thing about what it is. A
 * dialog is what a small settings surface actually is, and it brings a focus
 * trap, Escape, a scroll lock and a real close button for free — the last one
 * mattering most on a phone, where a full-width panel covers the capsule that
 * opened it.
 *
 * `width="min(100vw, 26rem)"` is what makes it full-screen on a phone and a
 * 416px drawer on a desktop, with no breakpoint hook and no JavaScript: at
 * 390px the `100vw` term wins. Nothing here can mismatch during hydration,
 * which matters for a control the server renders.
 *
 * Most people who see this never sign in — they opened a WhatsApp link — so
 * language lives here rather than only on `/profile`, which a guest has no way
 * to reach.
 */
export function GuestMenu({
  theme,
  /** Where to return after signing in — the page the drawer was opened from. */
  next,
}: {
  theme: "light" | "dark" | null;
  next?: string;
}) {
  const { copy, locale } = useCopy();
  const [open, setOpen] = useState(false);
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
    { value: "light", label: copy.appearance.light, icon: <SunIcon size={18} /> },
    { value: "dark", label: copy.appearance.dark, icon: <MoonIcon size={18} /> },
    { value: "system", label: copy.appearance.system, icon: <MonitorIcon size={18} /> },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
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
              empty circle for the first 600ms of every page load.
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
      </DialogTrigger>

      <DialogContent placement="right" width="min(100vw, 26rem)">
        <DialogHeader bordered>
          <Flex justify="between" align="center" gap="3">
            <DialogTitle>{copy.nav.guestMenuLabel}</DialogTitle>
            {/* asChild so the close is a real Button at the touch floor rather
                than the component's own small glyph. */}
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={copy.common.close}
              >
                <XIcon size={20} aria-hidden="true" />
              </Button>
            </DialogClose>
          </Flex>
        </DialogHeader>

        <DialogBody>
          <Stack gap="5">
            {/*
              A real anchor, not a router push. The old menu had to fake this:
              DropdownMenuItem renders a div and exposes no `asChild`, so
              cmd-click could not open it in a new tab (STACKMYTH-GAP #17).
              Outside a menu that constraint is gone.
            */}
            <Button asChild size="lg" fullWidth>
              <Link href={signInPath(next ?? ROUTES.myEvents)}>{copy.nav.signIn}</Link>
            </Button>

            <Divider />

            <Stack gap="2">
              <Text variant="small" color="muted">
                {copy.common.language}
              </Text>
              {/*
                Each language names itself. "English" is legible to someone who
                cannot read the Spanish beside it, which a translated "Inglés"
                would not be.
              */}
              <ToggleGroup
                type="single"
                variant="outline"
                value={locale}
                onValueChange={chooseLocale}
                /* `lg` here, unlike the old menu's `sm`: in a drawer there is
                   room, and 44px is the floor this app holds everywhere. */
                size="lg"
                disabled={pending}
              >
                {LOCALES.map((option: Locale) => (
                  <Toggle key={option} value={option}>
                    {getCopy(option).localeName}
                  </Toggle>
                ))}
              </ToggleGroup>
            </Stack>

            <Stack gap="2">
              <Text variant="small" color="muted">
                {copy.appearance.label}
              </Text>
              <ToggleGroup
                type="single"
                variant="outline"
                value={theme ?? "system"}
                onValueChange={chooseTheme}
                size="lg"
                disabled={pending}
              >
                {appearances.map((option) => (
                  <Toggle key={option.value} value={option.value} aria-label={option.label}>
                    {option.icon}
                  </Toggle>
                ))}
              </ToggleGroup>
            </Stack>
          </Stack>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
