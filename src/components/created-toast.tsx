"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { toast } from "@stackmyth/toast";

import { useCopy } from "@/components/copy-provider";

/**
 * Confirms a just-created event, once, on whichever page the creator landed on.
 *
 * Creation ends in a redirect, so the confirmation cannot come back with the
 * action — it has to survive a navigation. `?created=1` carries it, this
 * component spends it, and then rewrites the URL without the flag so a refresh
 * or a shared link does not announce a creation that happened yesterday.
 *
 * Creation lands on the event list, which said nothing at all before this: the
 * new event simply appeared among the others and you had to trust it had
 * worked. There used to be a second landing — the organizer panel, for an event
 * created with no account, where the links were the only way back — and it went
 * when events stopped being ownerless.
 */
export function CreatedToast() {
  const { copy } = useCopy();
  const pathname = usePathname();
  const fired = useRef(false);

  useEffect(() => {
    // Effects run twice under React's development double-invoke, and a toast
    // that appears twice is the kind of thing that only shows up in dev and
    // gets shipped anyway.
    if (fired.current) return;
    fired.current = true;

    toast.success(copy.eventCreated.heading);

    /*
      `history.replaceState`, NOT `router.replace`.

      Both strip the flag, but the router one re-renders the route, and that
      re-render lands in the middle of the toast's enter animation: the toast
      stays at opacity 0, translated up and half off screen, and never arrives.
      It looked like a broken toast component and was a navigation fighting it.

      Nothing here needs a re-render — the flag has already been spent, and the
      only reason to touch the URL at all is so a refresh or a shared link does
      not announce a creation that happened yesterday. Rewriting the address bar
      is exactly that and nothing more.
    */
    window.history.replaceState(null, "", pathname);
  }, [copy, pathname]);

  return null;
}
