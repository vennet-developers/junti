"use client";

import { useState, useTransition } from "react";

import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@stackmyth/avatar";
import { Button } from "@stackmyth/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stackmyth/dialog";
import { ChevronDownIcon, MonitorIcon, MoonIcon, SunIcon, UserIcon, XIcon } from "@stackmyth/icons";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Toggle, ToggleGroup } from "@stackmyth/toggle";

import { useCopy } from "@/components/copy-provider";
import { DrawerContent } from "@/components/drawer-content";
import { LanguageChoice } from "@/components/language-choice";
import { SignInForm } from "@/components/sign-in-form";
import { ROUTES } from "@/config/routes";
import { setTheme } from "@/lib/theme-actions";

/**
 * The header control for someone without an account.
 *
 * The capsule is the same one the signed-in header shows — same size, same
 * shape, an anonymous avatar where the photo goes — so the bar keeps one
 * silhouette and does not reflow the moment a session appears.
 *
 * It opens a **drawer, not a menu**, and that is a correction rather than a
 * style choice. This panel holds a form and two segmented controls, and a
 * `role="menu"` is for commands: a screen reader announcing "menu" and then
 * finding a text field and radio-like toggles inside is being told the wrong
 * thing about what it is. A dialog is what a small settings surface actually
 * is, and it brings a focus trap, Escape, a scroll lock and a real close
 * button for free — the last one mattering most on a phone, where a full-width
 * panel covers the capsule that opened it.
 *
 * Signing in happens **here**, not one page away. Both routes are a single tap
 * or a single field, and a page navigation to reach them costs whatever the
 * visitor was looking at — usually an event they were invited to. `/sign-in`
 * still exists for the redirect case, where `?next=` has to survive.
 *
 * It is the whole viewport on a phone and a 416px panel from 768px up — the
 * split, and why it cannot be a CSS cap, is documented in {@link DrawerContent}.
 *
 * Most people who see this never sign in — they opened a WhatsApp link — so
 * language lives here rather than only on `/profile`, which a guest has no way
 * to reach.
 */
export function GuestMenu({ theme }: { theme: "light" | "dark" | null }) {
  const { copy } = useCopy();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  /*
    Where to return after signing in: the page the drawer was opened from.

    Read from the router rather than threaded down as a prop, because the prop
    was the one thing keeping this header out of the root layout — a layout
    cannot know which route it is wrapping, but a client component standing on
    the page can. Each page used to pass its own path by hand; this is the same
    value with nobody forgetting to pass it.

    Two paths opt out. `/sign-in` because returning someone to the sign-in page
    after they signed in is a loop wearing a seatbelt, and `/` because a
    signed-in visitor never sees the home page — it redirects to the agenda, so
    sending them there directly skips a hop through a page that will bounce
    them.
  */
  const pathname = usePathname();
  const returnTo =
    pathname === ROUTES.home || pathname.startsWith(ROUTES.signIn) ? ROUTES.myEvents : pathname;

  function chooseTheme(value: string) {
    // ToggleGroup reports "" when the pressed item is pressed again. One of the
    // three is always in force, so a deselect is not a state this has.
    if (!value) return;
    startTransition(() => void setTheme(value === "system" ? null : value));
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

      <DrawerContent onDismiss={() => setOpen(false)}>
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
              The sign-in itself, not a link to it. Both routes are one tap and
              one field, and sending someone to another page to type an address
              they could have typed here loses whatever they were looking at —
              on an event page that is the thing they came for.

              `/sign-in` stays: it is where a protected route sends you, and it
              carries `?next=` so you land back where you were headed. This
              drawer's own return path is the page it was opened from.
            */}
            <Stack gap="3">
              <Text variant="small" color="muted">
                {copy.auth.signInSubheading}
              </Text>
              <SignInForm redirectTo={returnTo} />
            </Stack>

            <Divider />

            <LanguageChoice />

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
      </DrawerContent>
    </Dialog>
  );
}
