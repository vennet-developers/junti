"use client";

import { PullToRefresh } from "@stackmyth/pull-to-refresh";
import { useRouter } from "@tanstack/react-router";

import { useCopy } from "@/components/copy-provider";

/**
 * The installed app's reload gesture: drag down from the top, release, and
 * the loaders re-run. The spinner keeps turning until the invalidate
 * settles, so the gesture reports the same truth the data does.
 *
 * `standaloneOnly` on purpose — in a browser tab the platform already owns
 * this gesture, and stacking a second refresh on top of Safari's would
 * reload twice. This exists precisely for the home-screen app, which has no
 * reload button; alongside it, `RefreshOnReturn` covers coming back from
 * the background without any gesture at all.
 */
export function PullRefresh() {
  const { copy } = useCopy();
  const router = useRouter();

  return (
    <PullToRefresh
      standaloneOnly
      label={copy.common.refreshing}
      onRefresh={() => router.invalidate()}
    />
  );
}
