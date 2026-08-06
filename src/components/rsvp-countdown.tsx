import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { Banner } from "@stackmyth/banner";
import { ClockIcon } from "@stackmyth/icons";
import { Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import type { Copy } from "@/config/copy";
import {
  countdownParts,
  remaining,
  rsvpState,
  urgency,
  type ConvocationInput,
  type Remaining,
  type RsvpState,
} from "@/domain/convocation";
import { formatEventDateTimeShort } from "@/lib/format";

/**
 * The clock over the "¿vienes?" box, and the thing that closes it in front of
 * the reader.
 *
 * A countdown is only worth having if it is honest at zero. The version that
 * would have been easier — render the state the loader computed and leave it —
 * shows 00:00 above a form that still works, because nothing re-runs on a page
 * that has been open since yesterday. So this owns the clock for the page:
 * {@link useConvocation} ticks, and the moment the state stops being `open` it
 * invalidates the router, which re-runs the loader and swaps the form for the
 * closed notice. The server guard is still the authority — this is what makes
 * the screen agree with it.
 */

export interface Convocation {
  state: RsvpState;
  /**
   * What to count down to, or null when there is nothing: no deadline was set,
   * or answers are already shut and the reason is on screen instead.
   *
   * The deadline travels with the time left rather than being read off the
   * event again at the call site, so there is no way to render a clock without
   * the moment it is counting to.
   */
  countdown: { left: Remaining; deadline: Date } | null;
}

/**
 * The event's answering state, on the reader's clock.
 *
 * **First render uses the server's `now`, deliberately.** The component paints
 * on the server and again on hydration, and reading `new Date()` in both places
 * gives two different answers for any page rendered near a second boundary —
 * which React reports as a hydration mismatch on the one component whose job is
 * to be trusted about time. The real clock is adopted in an effect, which runs
 * only on the client and only after the markup has matched.
 */
export function useConvocation(event: ConvocationInput, serverNow: Date): Convocation {
  const router = useRouter();
  const [now, setNow] = useState(() => serverNow);

  useEffect(() => {
    // Immediately, then every second. The immediate call is what corrects a
    // page served from a cache, where the server's `now` may be minutes stale.
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const state = rsvpState(event, now);
  const closedByClock = state === "expired";

  /*
    Re-run the loader once, when the clock crosses the deadline. Keyed on the
    boolean rather than on `now`, so this fires on the transition and not sixty
    times a minute for the rest of the page's life.
  */
  useEffect(() => {
    if (closedByClock) void router.invalidate();
  }, [closedByClock, router]);

  const deadline = event.rsvpDeadline;

  return {
    state,
    countdown:
      state === "open" && deadline !== null
        ? { left: remaining(deadline, now), deadline }
        : null,
  };
}

interface Props {
  countdown: NonNullable<Convocation["countdown"]>;
  readerTimeZone: string;
  copy: Copy;
}

/** Calm is not an alarm; the last hour is. */
const VARIANT = { calm: "info", soon: "warning", urgent: "error" } as const;

export function RsvpCountdown({ countdown, readerTimeZone, copy }: Props) {
  const { left, deadline } = countdown;
  const tier = urgency(left);
  const parts = countdownParts(left);
  const units = copy.event.convocationUnits;

  return (
    <Banner
      variant={VARIANT[tier]}
      /*
        Never a live region, at any urgency.

        A `role="alert"` that re-renders every second would interrupt a screen
        reader once per second forever — it would make the page unusable rather
        than urgent. The numbers below are hidden from assistive technology for
        the same reason, and the sentence under them says the same thing in a
        form that does not move.
      */
      live="off"
      icon={<ClockIcon size={18} aria-hidden="true" />}
      title={tier === "urgent" ? copy.event.convocationUrgentTitle : copy.event.convocationTitle}
    >
      <Stack gap="1">
        <Flex gap="3" align="baseline" aria-hidden="true">
          {parts.map((part) => (
            <Text key={part.unit} variant="lead" weight="bold">
              {units[part.unit](part.value)}
            </Text>
          ))}
        </Flex>
        <Text variant="small">
          {copy.event.convocationClosesAt(
            formatEventDateTimeShort(deadline, readerTimeZone, copy.intlLocale),
          )}
        </Text>
      </Stack>
    </Banner>
  );
}
