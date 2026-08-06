"use client";

import { useRouter } from "@tanstack/react-router";
import { useTransition } from "react";

import { Button } from "@stackmyth/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@stackmyth/dropdown-menu";
// No pencil in the set — the 132 icons have no edit glyph at all — so the
// second duplicate is marked by what it produces: a copy you then fill in.
import {
  ClipboardIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
} from "@stackmyth/icons";
import { Box, Flex } from "@stackmyth/layout";
import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";
import { Link } from "@/components/link";
import { ROUTES } from "@/config/routes";

import { duplicateEventFn } from "./-fns";

/**
 * What you can do with one of your events without opening it.
 *
 * **Two are visible; the rest are behind the menu.** Sharing is what account
 * holders come here for — creation now lands them on this list — and managing
 * is where the roster and the money live. Those two run every week. Looking at
 * the event through somebody else's eyes runs once, before you send the link;
 * duplicating runs when a season starts.
 *
 * That split replaced a disclosure holding all four: every card carried a row
 * reading "Options" that had to be opened before anything could be done, so
 * the common case cost a tap to reveal a button that was always going to be
 * there. Now the common case costs nothing and the rare case costs the tap.
 *
 * **`sm`, not `md`.** This app runs at `--sm-density-factor: 1.4`, so every
 * control's padding is multiplied by it and `sm` already clears the 44px touch
 * floor. At `md` the three of them needed 344px of a card that has 318 on a
 * 390px phone — measured, not guessed — and a footer that wraps is a footer
 * that has stopped being a row.
 *
 * Inside the menu the two previews sit above the line and the two duplicates
 * below it, because the halves answer different questions: one is about this
 * event, the other makes a new one.
 *
 * The two duplicates are deliberate and do different jobs:
 *
 * - **Duplicate** creates it there and then, same time next week. For the
 *   fixture that never changes — five-a-side every Thursday — where opening a
 *   form to confirm what you already know is the friction.
 * - **Duplicate and edit** opens the form already describing next week, for the
 *   week the pitch moved or the price went up.
 */
export function EventCardActions({
  eventId,
  managePath,
  eventPath,
  whatsAppUrl,
}: {
  eventId: string;
  /** Null when the reader does not own this event — see `EventListItem`. */
  managePath: string | null;
  eventPath: string;
  whatsAppUrl: string;
}) {
  const { copy } = useCopy();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /*
    Somebody who is merely going gets one button, and it is the event.

    Everything else here is an owner's verb — share the invitation, open the
    roster and the money, duplicate for next week — and offering a guest a
    dimmed version of a menu they can never use would be worse than not
    offering it. Sharing is the one that could arguably survive, since the
    public link is public; it goes anyway, because a guest forwarding an
    invitation on the organizer's behalf is not a thing this product asks
    anyone to do.
  */
  if (!managePath) {
    return (
      <Flex gap="2" align="center" wrap="nowrap">
        <Button asChild size="sm" variant="secondary" shape="pill">
          <Link href={eventPath}>{copy.auth.openEvent}</Link>
        </Button>
      </Flex>
    );
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateEventFn({ data: { eventId } });

      // Both outcomes float. The card is one of a list and the message used to
      // appear underneath it, which pushed every card below it down — a layout
      // shift to say something that stops being true in four seconds.
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(copy.auth.duplicatedNotice);
        // What `revalidatePath` did on the server under Next: re-run the
        // loaders, so the new copy appears in the list it was just added to.
        await router.invalidate();
      }
    });
  }

  return (
    <Flex gap="2" align="center" wrap="nowrap">
      {/* Box(as="a") so `asChild` clones a Stackmyth primitive. WhatsApp is
          genuinely external, so this one is not the router's Link. */}
      <Button asChild size="sm" variant="primary" shape="pill">
        <Box as="a" href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
          {copy.auth.share}
        </Box>
      </Button>

      {/* The Link shim for internal routes — a bare anchor is a full page load
          where the router would have made a soft navigation. */}
      <Button asChild size="sm" variant="secondary" shape="pill">
        <Link href={managePath}>{copy.auth.manage}</Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            iconOnly
            shape="pill"
            aria-label={copy.common.options}
          >
            <MoreHorizontalIcon size={18} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {/*
            The two previews first, and above the separator, because they are
            about THIS event: what the person you are about to send the link to
            actually lands on. Everything below the line makes a different
            event. See `src/domain/preview.ts` for why only the owner is
            offered them — which is also why they sit inside the branch that
            already required `managePath`.

            Router pushes rather than links, for the same reason as
            "duplicate and edit" below: `DropdownMenuItem` renders a div and
            takes no `asChild`, so there is no anchor to hang an href on.
            STACKMYTH-GAP #17.
          */}
          <DropdownMenuItem onSelect={() => router.navigate({ to: `${eventPath}?as=guest` as never })}>
            <Flex gap="2" align="center">
              <EyeIcon size={16} aria-hidden="true" />
              {copy.event.preview.viewAsGuest}
            </Flex>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => router.navigate({ to: `${eventPath}?as=stranger` as never })}
          >
            <Flex gap="2" align="center">
              <EyeOffIcon size={16} aria-hidden="true" />
              {copy.event.preview.viewAsStranger}
            </Flex>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled={pending} onSelect={duplicate}>
            <Flex gap="2" align="center">
              <CopyIcon size={16} aria-hidden="true" />
              {pending ? copy.auth.duplicating : copy.auth.duplicate}
            </Flex>
          </DropdownMenuItem>

          {/*
            A router push rather than a link, and that is a downgrade the
            library forces: `DropdownMenuItem` renders a div and exposes no
            `asChild`, so there is no anchor to give an href to — no
            cmd-click, no "copy link address". Logged as STACKMYTH-GAP #17.
            It is the least-used of the four, which is why this is the one
            that pays.
          */}
          <DropdownMenuItem
            onSelect={() => router.navigate({ to: `${ROUTES.newEvent}?from=${eventId}` as never })}
          >
            <Flex gap="2" align="center">
              <ClipboardIcon size={16} aria-hidden="true" />
              {copy.auth.duplicateAndEdit}
            </Flex>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Flex>
  );
}
