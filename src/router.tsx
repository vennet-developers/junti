import { createRouter } from "@tanstack/react-router";

import { RouteBoundary, RouteNotFound, RoutePending } from "@/components/route-boundaries";
import { routeTree } from "@/routeTree.gen";

/**
 * One router per request on the server, one per session in the browser.
 *
 * The defaults here are what `error.tsx`, `not-found.tsx` and the five
 * `loading.tsx` files were in the Next app: boundaries every route gets
 * without asking. Individual routes override with their own
 * `pendingComponent` / `errorComponent` where the generic ones are not
 * enough — the my-events agenda skeleton, for instance.
 *
 * `defaultPendingMs` keeps fast loaders from flashing a spinner: the pending
 * UI only appears once a load has taken 300ms, and then stays at least 500ms
 * so it reads as a state rather than a flicker.
 */
export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultNotFoundComponent: RouteNotFound,
    defaultErrorComponent: RouteBoundary,
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 300,
    defaultPendingMinMs: 500,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
