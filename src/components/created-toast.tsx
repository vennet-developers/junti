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
 * Both landings need it, for different reasons:
 *
 * - **Anonymous** creators land on the organizer page, where the links are the
 *   whole point. The toast is the celebration; the instruction to keep the
 *   links stays on the page, because that one is still true tomorrow.
 * - **Account holders** land on their event list, which until now said nothing
 *   at all — the new event simply appeared in a list, and you had to trust it
 *   had worked.
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
