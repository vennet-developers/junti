import type { Metadata } from "next";

import { SmokeClient } from "./smoke-client";

/**
 * Throwaway integration check for the Stackmyth UI layer.
 *
 * Build order step 2: prove the stack compiles, themes, and lays out correctly
 * at 390px *before* any product code depends on it. Finding out on step 8 that
 * the component library doesn't integrate is the expensive failure mode.
 *
 * Kept rather than deleted: it is the cheapest regression check that the UI
 * layer still integrates after a Stackmyth bump. It is noindex'd and linked
 * from nowhere. Delete the directory to remove it.
 */
export const metadata: Metadata = {
  title: "Stackmyth smoke test",
  robots: { index: false, follow: false },
};

export default function StackmythSmokePage() {
  return <SmokeClient />;
}
