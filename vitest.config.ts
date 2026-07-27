import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Tests cover src/domain only — the money split and the waitlist rules. That is
 * the part with real rules and the part where a bug loses somebody's money.
 * UI is verified by using it, not by asserting on markup.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/domain/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
