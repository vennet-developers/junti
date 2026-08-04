import "@/server/assert-server";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request memoisation — what `React.cache` was doing for `getOrganizer`
 * under Next, rebuilt on the primitive that actually provides the scope.
 *
 * `React.cache` only deduplicates inside a React Server Components render;
 * under TanStack Start the same call happens in loaders, server functions and
 * middleware, none of which are RSC renders, so it would silently stop
 * deduplicating — and the call it guards revalidates the session against
 * Supabase over the network. Twice per request is the exact cost the cache
 * existed to avoid.
 *
 * The store is opened by `requestMemoMiddleware` in `src/start.ts`, so every
 * request gets a fresh map and nothing leaks between two people's requests.
 * Outside a request — scripts, tests — there is no store and the wrapped
 * function just runs, which is also the correct behaviour there.
 */
const requestStore = new AsyncLocalStorage<Map<string, unknown>>();

export function runWithRequestMemo<T>(fn: () => T): T {
  return requestStore.run(new Map(), fn);
}

export function memoPerRequest<T>(key: string, fn: () => Promise<T>): () => Promise<T> {
  return () => {
    const map = requestStore.getStore();
    if (!map) return fn();

    if (!map.has(key)) {
      map.set(key, fn());
    }
    return map.get(key) as Promise<T>;
  };
}
