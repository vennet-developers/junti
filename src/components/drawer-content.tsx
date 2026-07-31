"use client";

import { useRef, type ComponentProps, type TouchEvent } from "react";

import { useIsMobile } from "@stackmyth/core";
import { DialogContent } from "@stackmyth/dialog";

/**
 * The account drawer's panel, shared by {@link GuestMenu} and
 * {@link ProfileMenu} so the two states of the same control cannot drift.
 *
 * **Placement is responsive, and the split is behavioural, not cosmetic.**
 * On a phone the panel enters from the top and leaves upward — it opens from
 * a control that lives in the top bar, so the motion continues the gesture
 * that started it. From 768px up it stays the side panel it has always been.
 * The boundary is the library's own mobile boundary, via `useIsMobile`.
 *
 * **Width is decided here too, on the same boundary.** It used to be
 * `width="100%"` with a `.junti-drawer { max-width: 26rem }` media query on
 * top, which worked while DialogContent set only `width` inline. Since 0.24.x
 * the `width` prop sets `max-width` inline as well, and no stylesheet rule can
 * out-rank an inline declaration — the desktop panel silently became the whole
 * viewport. One hook already answers "phone or not" for the placement; the
 * width now rides the same answer instead of fighting the component's styles.
 * 26rem, not a `min()` cap, because 416px sits inside the range of real phone
 * widths (iPhone Pro Max 430px, Pixel 412px) — a cap would leave those phones
 * a strip of page down the edge, which is why the phone branch is "100%".
 *
 * **On a phone the sheet is the whole viewport, and the height says so.** For
 * a top sheet the library reads `size` as a height, and the default `md` is
 * 50dvh — the panel ended half way down the screen with its own inner
 * scrollbar while the page sat unusable behind the other half. That is the
 * height the right-hand placement always got for free from `height: 100%`.
 *
 * `height="100dvh"` rather than `size="full"`, which also reaches 100dvh: the
 * `full` variant is a full-bleed surface, and it zeroes the padding, border
 * and radius along with it — the title and the close button ended up against
 * the glass. The `height` prop is written inline, so it beats the class-level
 * 50dvh and leaves everything else alone. `dvh`, not `vh`, because mobile
 * browsers shrink the viewport as their chrome retracts and `vh` keeps
 * measuring the taller one, hanging the last row below the fold.
 *
 * Nothing is passed on the desktop branch: for a side panel `size` means
 * WIDTH, and the height is already 100%.
 *
 * Filling the screen also means dropping the frame — see `.drawer-full-bleed`
 * for why the border, shadow and corner radius all describe an edge that no
 * longer has a page behind it.
 *
 * `useIsMobile` reads `matchMedia` after hydration, which is fine here for a
 * reason worth stating: the panel renders nothing until it is opened, and
 * opening requires a tap, which requires hydration. There is no SSR frame in
 * which the wrong placement could paint.
 *
 * **Swipe-up dismisses it on a phone.** The library covers Escape, backdrop
 * and the close button; the swipe is this component's own, because a sheet
 * that arrived from the top edge invites being pushed back out of it. The
 * gesture must be decisively vertical (more Y than X, past a threshold) so
 * horizontal scrolling inside the panel never closes it by accident.
 *
 * It also has to keep its hands off text. A drag inside an input is how you
 * place a caret and select — the drawer now carries a sign-in field, and
 * before it did, every target in here was a button where a drag meant nothing
 * else. Gestures starting on an entry field are left to the field.
 *
 * Dismissal arrives as an `onDismiss` callback rather than through a dialog
 * context, because the library does not export one — both menus already own
 * their `open` state, so they simply hand the setter down.
 */
const SWIPE_DISMISS_PX = 60;

/** Where a drag means "select text", not "push the sheet away". */
const TEXT_ENTRY_SELECTOR = "input, textarea, [contenteditable]";

export function DrawerContent({
  onDismiss,
  ...props
}: Omit<ComponentProps<typeof DialogContent>, "placement"> & {
  /** Close the dialog — the swipe gesture's exit path. */
  onDismiss: () => void;
}) {
  const isMobile = useIsMobile();

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;

    // Started on a field: leave the whole gesture alone. Recorded as null
    // rather than simply skipped, so a previous start cannot linger and turn
    // this touch's release into a dismissal.
    const target = event.target as Element | null;
    if (target?.closest?.(TEXT_ENTRY_SELECTOR)) {
      touchStart.current = null;
      return;
    }

    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !isMobile) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    // Upward, decisively vertical, and far enough to be meant.
    if (deltaY <= -SWIPE_DISMISS_PX && Math.abs(deltaY) > Math.abs(deltaX)) {
      onDismiss();
    }
  }

  return (
    <DialogContent
      {...props}
      placement={isMobile ? "top" : "right"}
      width={isMobile ? "100%" : "26rem"}
      height={isMobile ? "100dvh" : undefined}
      // Frame off once it fills the screen; on the desktop panel the border
      // and shadow are what separate it from the page behind it.
      className={
        [props.className, "drawer", isMobile ? "drawer-full-bleed" : null]
          .filter(Boolean)
          .join(" ") || undefined
      }
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    />
  );
}
