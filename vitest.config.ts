import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Tests cover the parts where a bug is both consequential and INVISIBLE.
 *
 * That was src/domain alone — the money split and the waitlist rules, where a
 * mistake loses somebody's money. UI stays out of it and is verified by using
 * it: asserting on markup mostly tests that the markup is what it is.
 *
 * src/lib joined for one narrow reason. A correlated subquery whose columns
 * come out unqualified silently returns zero rows instead of erroring, so the
 * page renders a plausible "nobody yet" for every event and nothing anywhere
 * says otherwise — that shipped once and was found by accident. Rendering the
 * query to SQL and asserting its shape is the only place that failure is
 * visible. See src/lib/roster-sql.test.ts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/domain/**/*.test.ts", "src/lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
