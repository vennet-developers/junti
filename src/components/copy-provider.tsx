"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

import { getCopy, type Copy, type Locale } from "@/config/copy";

/**
 * Makes the interface strings available to client components.
 *
 * Takes a `Locale` — a string — and looks the strings up on this side, rather
 * than receiving the resolved `Copy` object as a prop. That is not a style
 * choice: `Copy` holds functions like `spotsLeft(n)`, and functions do not
 * cross the server-to-client boundary. Passing the object would fail to
 * serialize; passing two characters and doing the lookup here cannot.
 *
 * The cost is both language files in the client bundle, which is a few
 * kilobytes of plain strings and buys an instant switch with no round trip.
 */

interface CopyContextValue {
  copy: Copy;
  locale: Locale;
}

const CopyContext = createContext<CopyContextValue | null>(null);

export function CopyProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<CopyContextValue>(() => ({ copy: getCopy(locale), locale }), [locale]);

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}

export function useCopy(): CopyContextValue {
  const value = use(CopyContext);

  if (!value) {
    throw new Error("useCopy must be used inside <CopyProvider>. Check the nearest layout.");
  }

  return value;
}
