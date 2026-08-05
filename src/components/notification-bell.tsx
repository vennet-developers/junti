"use client";

import { useCallback, useEffect, useState, useTransition, type MouseEvent } from "react";

import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { useIsMobile } from "@stackmyth/core";
import { Dialog, DialogBody, DialogClose, DialogHeader, DialogTitle } from "@stackmyth/dialog";
import { EmptyState } from "@stackmyth/empty-state";
import { BellIcon, XIcon } from "@stackmyth/icons";
import { Box, Divider, Flex, Stack } from "@stackmyth/layout";
import { Popover, PopoverContent, PopoverTrigger } from "@stackmyth/popover";
import { Spinner } from "@stackmyth/spinner";
import { Text } from "@stackmyth/text";
import { useRouter } from "@tanstack/react-router";

import { useCopy } from "@/components/copy-provider";
import { DrawerContent } from "@/components/drawer-content";
import { Link } from "@/components/link";
import { unreadBadge } from "@/domain/notifications";
import type { NotificationView } from "@/lib/notifications";

import {
  markAllNotificationsReadFn,
  markNotificationReadFn,
  notificationsFn,
} from "@/routes/-notification-fns";

/**
 * The bell, and the two shapes of the panel behind it.
 *
 * **The list is never in a loader.** Only the count arrives with the page; the
 * rows are fetched the first time somebody opens the panel and re-fetched on
 * every open after that. A notification list rendered into every screen of the
 * app would be a join and twenty rows for a control most visits never touch,
 * and it would be stale by the time anybody looked.
 *
 * **One open state, two presentations — AC-5.** On a phone it is the same top
 * sheet the account menu uses, so both things in the header behave alike; from
 * 768px up it is a popover anchored under the bell, because a full-height side
 * panel is a lot of furniture for reading three lines and going back to what
 * you were doing.
 *
 * The switch is deliberately arranged so nothing depends on `useIsMobile`
 * before hydration. Its first client render reads `window.innerWidth`
 * immediately, which does NOT match what the server assumed — so the trigger
 * lives permanently inside `PopoverTrigger` (identical on both sides) and the
 * phone sheet is gated on `open`, which cannot be true until somebody has
 * tapped, which cannot happen before hydration.
 */
export function NotificationBell({ unread }: { unread: number }) {
  const { copy } = useCopy();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const badge = unreadBadge(unread);

  const trigger = (
    <PopoverTrigger>
      <Button
        type="button"
        variant="secondary"
        /* The account capsule beside it is `sm` for the density reasons written
           in ProfileMenu; matching it keeps the two controls one bar rather
           than two sizes of button that happen to be adjacent. */
        size="sm"
        shape="pill"
        aria-label={
          unread > 0
            ? `${copy.notifications.open} — ${copy.notifications.unread(unread)}`
            : copy.notifications.open
        }
      >
        <BellIcon size={18} aria-hidden="true" />
        {/* Inline rather than pinned to a corner. A count sitting in the flow
            of the button needs no absolute positioning to place it and no
            second thought about what happens when it reaches three
            characters. */}
        {badge ? (
          <Badge variant="error" size="sm" aria-hidden="true">
            {badge}
          </Badge>
        ) : null}
      </Button>
    </PopoverTrigger>
  );

  return (
    <>
      {/*
        `open && !isMobile`: the popover is the desktop presentation only. On a
        phone the same tap still travels through here — the trigger is inside
        it — and simply opens the sheet below instead.
      */}
      <Popover open={open && !isMobile} onOpenChange={setOpen}>
        {trigger}
        <PopoverContent side="bottom" align="end" aria-label={copy.notifications.title}>
          <Box width="min(22rem, calc(100vw - 2rem))">
            <NotificationPanel unread={unread} onClose={() => setOpen(false)} />
          </Box>
        </PopoverContent>
      </Popover>

      {open && isMobile ? (
        <Dialog open onOpenChange={setOpen}>
          <DrawerContent onDismiss={() => setOpen(false)}>
            <DialogHeader bordered>
              <Flex justify="between" align="center" gap="3">
                <DialogTitle>{copy.notifications.title}</DialogTitle>
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
              <NotificationPanel unread={unread} onClose={() => setOpen(false)} />
            </DialogBody>
          </DrawerContent>
        </Dialog>
      ) : null}
    </>
  );
}

/**
 * The list itself, identical in both presentations.
 *
 * Shared rather than duplicated for the same reason {@link DrawerContent} is:
 * two copies of a list with a "mark all read" control in it would drift, and
 * the one that drifts is always the one nobody is looking at.
 */
function NotificationPanel({ unread, onClose }: { unread: number; onClose: () => void }) {
  const { copy } = useCopy();
  const router = useRouter();

  const [items, setItems] = useState<NotificationView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  /**
   * The first page, fetched once because the panel just opened.
   *
   * Nothing is set synchronously in here — every `setState` is inside a promise
   * callback. That is not style: setting state in the body of an effect
   * cascades a second render before the browser paints, and the lint rule that
   * catches it is right.
   *
   * The `live` flag is the ordinary unmount guard. Somebody who opens the panel
   * and immediately closes it again would otherwise land a state update on a
   * component that is gone.
   */
  useEffect(() => {
    let live = true;

    notificationsFn({ data: {} })
      .then((page) => {
        if (!live) return;
        setItems(page.items);
        setCursor(page.cursor);
      })
      // A panel that says "nothing" is a smaller lie than one that throws the
      // whole page away. The count in the header is still true.
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, []);

  /**
   * The next page, appended — AC-7.
   *
   * Only ever reached from the "see more" control, so the cursor is always
   * real and setting `loading` here is a click handler doing what a click
   * handler is for.
   */
  const fetchMore = useCallback(async (from: string) => {
    setLoading(true);
    try {
      const page = await notificationsFn({ data: { cursor: from } });
      setItems((current) => [...current, ...page.items]);
      setCursor(page.cursor);
    } catch {
      // Stop offering more rather than offering a button that never works.
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Marks one read on the way out of the panel — AC-3.
   *
   * Fire and forget, because the anchor is navigating and nobody should wait on
   * a write to see the screen they asked for. If it fails, the item stays bold
   * and the next tap tries again.
   *
   * Cmd/ctrl/shift and the middle button mean "open that elsewhere, leave me
   * here" — the row is a real anchor precisely so that works — so the panel
   * stays put for those, exactly as the account menu does.
   */
  function open(id: string, event: MouseEvent<HTMLAnchorElement>) {
    startTransition(async () => {
      await markNotificationReadFn({ data: { id } }).catch(() => {});
      await router.invalidate();
    });

    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    onClose();
  }

  function markAll() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));

    startTransition(async () => {
      await markAllNotificationsReadFn().catch(() => {});
      await router.invalidate();
    });
  }

  if (loading && items.length === 0) {
    return (
      <Flex justify="center" py="5">
        <Spinner aria-label={copy.common.loading} />
      </Flex>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BellIcon size={24} aria-hidden="true" />}
        title={copy.notifications.emptyTitle}
        description={copy.notifications.emptyHelp}
      />
    );
  }

  return (
    <Stack gap="2">
      {unread > 0 ? (
        <>
          <Flex justify="end">
            <Button type="button" variant="ghost" size="sm" onClick={markAll}>
              {copy.notifications.markAllRead}
            </Button>
          </Flex>
          <Divider />
        </>
      ) : null}

      <Stack gap="1">
        {items.map((item) => (
          <Button
            key={item.id}
            asChild
            variant="ghost"
            size="lg"
            fullWidth
            justify="start"
            flush
          >
            {/*
              A real anchor, not a div with a click handler. Same reason the
              account menu's destinations are anchors: cmd-click has to open a
              notification in a new tab, and "open in new tab" on a div is
              nothing at all.
            */}
            <Link href={item.href} onClick={(event) => open(item.id, event)}>
              <Flex gap="3" align="start" width="100%">
                {/*
                  Unread, as a mark rather than a colour on the text — AC-2.
                  Colour alone is not a distinction for everybody who reads
                  this, and the weight below carries it a second time.
                */}
                <Box pt="2" flexShrink={0}>
                  <Badge
                    dot
                    variant={item.read ? "ghost" : "error"}
                    aria-hidden="true"
                  />
                </Box>

                <Stack gap="0" minWidth="0" width="100%">
                  <Text as="span" variant="small" weight={item.read ? "normal" : "semibold"}>
                    {item.text}
                  </Text>
                  <Text as="span" variant="small" color="muted">
                    {item.eventTitle} · {item.when}
                  </Text>
                </Stack>
              </Flex>
            </Link>
          </Button>
        ))}
      </Stack>

      {cursor ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          fullWidth
          disabled={loading}
          onClick={() => void fetchMore(cursor)}
        >
          {loading ? copy.common.loading : copy.notifications.more}
        </Button>
      ) : null}
    </Stack>
  );
}
