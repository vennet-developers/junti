"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type MouseEvent } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@stackmyth/avatar";
import { Button } from "@stackmyth/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stackmyth/dialog";
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  LogOutIcon,
  MessageCircleIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
  XIcon,
} from "@stackmyth/icons";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Toggle, ToggleGroup } from "@stackmyth/toggle";

import { useCopy } from "@/components/copy-provider";
import { DrawerContent } from "@/components/drawer-content";
import { LanguageChoice } from "@/components/language-choice";
import { ROUTES } from "@/config/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { setTheme } from "@/lib/theme-actions";

/**
 * The account panel: who you are, where you can go, how it should look.
 *
 * A drawer rather than a dropdown, for the reasons set out in
 * {@link GuestMenu} — the two are the same control in two states and must not
 * diverge. In short: this holds a segmented control, which is not a menu
 * command, and a phone needs a real close button because a full-width panel
 * covers the capsule that opened it. It fills the viewport on a phone and is a
 * 416px panel from 768px up — the split lives in {@link DrawerContent}.
 *
 * The destinations are real anchors now. As menu items they could not be:
 * DropdownMenuItem renders a div and exposes no `asChild`, so cmd-click could
 * never open one in a new tab (STACKMYTH-GAP #17). Outside a menu, `Button
 * asChild` + next/link gives a genuine link with a genuine href.
 *
 * Language sits here beside appearance, for the same reason appearance does:
 * both are look-at-it-now choices, and a signed-in reader had no quick way to
 * change the one thing that rewrites every string on the page — `/profile` was
 * two navigations away, in whichever language they were trying to leave.
 * `/profile` keeps the full pair, language and timezone, including the "follow
 * my browser" option this quick switch has no room to explain.
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
  const [open, setOpen] = useState(false);
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

    // "system" is this panel's word for "no stored preference". The server
    // stores null, and null is what lets `prefers-color-scheme` take over.
    startTransition(() => void setTheme(next === "system" ? null : next));
  }

  /**
   * Close the drawer as a destination is chosen.
   *
   * Leaving for another page closed it already, by unmounting the header that
   * holds it. Going to the page you are already on does not: `/profile` →
   * "My profile" re-renders nothing, so the panel stayed open over the screen
   * it had just been asked to show. The panel closing is what the tap means,
   * whether or not anything navigates.
   *
   * Except when the click is asking for a second tab. Cmd/ctrl, shift and the
   * middle button all mean "open that elsewhere, leave me where I am", and
   * these are real anchors precisely so that works — closing the panel out
   * from under someone who is staying put would take half of it back.
   */
  function closeUnlessOpeningElsewhere(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    setOpen(false);
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
          /*
            `sm`, not `lg`, because this app runs at --sm-density-factor 1.4.
            Every control's padding is multiplied by that, so `sm` already
            clears the 44px touch target here — it measures 50.8px — while
            `lg` came out at 62px, and a 32px avatar inside a 62px capsule
            reads as a small photo adrift in a large button rather than as
            one object. At `sm` the avatar fills 63% of the height.
          */
          size="sm"
          aria-label={copy.auth.menuLabel}
          // `pill` rounds the ends and pulls the leading padding in to match
          // the vertical padding, so the avatar sits concentric in the
          // capsule's rounded end instead of flush against it.
          shape="pill"
        >
          {/* Button gaps and centres its own children — no Flex needed. */}
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
        </Button>
      </DialogTrigger>

      <DrawerContent onDismiss={() => setOpen(false)}>
        <DialogHeader bordered>
          <Flex justify="between" align="start" gap="3">
            <Flex gap="3" align="center" minWidth="0">
              <Box flexShrink={0}>
                <Avatar size="md">
                  {organizer.avatarUrl ? (
                    <AvatarImage src={organizer.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Box>
              <Stack gap="0" minWidth="0">
                <DialogTitle>{organizer.displayName}</DialogTitle>
                {organizer.email ? (
                  <Text variant="small" color="muted">
                    {organizer.email}
                  </Text>
                ) : null}
              </Stack>
            </Flex>

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
            <Stack gap="2">
              {/* Real links. `justify="start"` so a full-width button reads as a
                  row of navigation rather than a centred call to action, and
                  `flush` drops the button's own inline padding so the icons
                  line up with the section labels below. */}
              <Button asChild variant="ghost" size="lg" fullWidth justify="start" flush>
                <Link href={ROUTES.myEvents} onClick={closeUnlessOpeningElsewhere}>
                  <Flex gap="3" align="center">
                    <CalendarIcon size={18} aria-hidden="true" />
                    {copy.auth.myEventsLink}
                  </Flex>
                </Link>
              </Button>

              {/* Second, right under the events: it is where an organizer goes
                  when something is waiting, and it reads across all of them. */}
              <Button asChild variant="ghost" size="lg" fullWidth justify="start" flush>
                <Link href={ROUTES.approvals} onClick={closeUnlessOpeningElsewhere}>
                  <Flex gap="3" align="center">
                    <CheckCircleIcon size={18} aria-hidden="true" />
                    {copy.approvals.link}
                  </Flex>
                </Link>
              </Button>

              <Button asChild variant="ghost" size="lg" fullWidth justify="start" flush>
                <Link href={ROUTES.profile} onClick={closeUnlessOpeningElsewhere}>
                  <Flex gap="3" align="center">
                    <UserIcon size={18} aria-hidden="true" />
                    {copy.profile.link}
                  </Flex>
                </Link>
              </Button>

              <Button asChild variant="ghost" size="lg" fullWidth justify="start" flush>
                <Link href={ROUTES.messages} onClick={closeUnlessOpeningElsewhere}>
                  <Flex gap="3" align="center">
                    <MessageCircleIcon size={18} aria-hidden="true" />
                    {copy.messages.link}
                  </Flex>
                </Link>
              </Button>
            </Stack>

            <Divider />

            <LanguageChoice />

            <Stack gap="2">
              <Text variant="small" color="muted">
                {copy.appearance.label}
              </Text>
              {/*
                A segmented control rather than three rows: the choice is
                mutually exclusive, the options are short, and comparing them
                side by side is the whole point. `outline` gives each segment a
                border so the row reads as one control with a chosen option —
                the default variant marks the pressed item with a tint that in
                light mode sits too close to the surface to spot.
              */}
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

            <Divider />

            {/* Not a link: signing out is an action with a side effect, and it
                has to finish before the redirect. */}
            <Button
              type="button"
              variant="ghost"
              size="lg"
              fullWidth
              justify="start"
              flush
              disabled={pending}
              onClick={signOut}
            >
              <Flex gap="3" align="center" color="var(--sm-error-accent)">
                <LogOutIcon size={18} aria-hidden="true" />
                {copy.auth.signOut}
              </Flex>
            </Button>
          </Stack>
        </DialogBody>
      </DrawerContent>
    </Dialog>
  );
}
