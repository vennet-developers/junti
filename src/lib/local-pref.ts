"use client";

import { useSyncExternalStore } from "react";

/**
 * A string preference that survives the visit, backed by localStorage.
 *
 * `useSyncExternalStore` rather than state-plus-effect, for the same two
 * reasons as the install offer: the server snapshot is the fallback, so SSR
 * and first client paint agree and the stored value arrives with hydration
 * instead of through a setState-in-effect the lint rule (rightly) rejects.
 * Writes notify every subscribed component, so two views of the same
 * preference cannot drift within a page.
 *
 * Storage failures (private mode, full quota) degrade to session-only
 * behaviour: the selection still works, it just does not survive.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useLocalPref(key: string, fallback: string): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );

  const set = (next: string) => {
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Session-only, then.
    }
    for (const listener of listeners) listener();
  };

  return [value, set];
}
