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
 * Dismissal arrives as an `onDismiss` callback rather than through a dialog
 * context, because the library does not export one — both menus already own
 * their `open` state, so they simply hand the setter down.
 */
const SWIPE_DISMISS_PX = 60;

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
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    />
  );
}
