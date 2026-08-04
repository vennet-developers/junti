import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * TanStack Start over Vite, deployed through Nitro.
 *
 * Three constraints worth knowing before touching the plugin list:
 *
 * - `tanstackStart()` must come BEFORE `react()`. The Start compiler rewrites
 *   server functions and isomorphic splits at the module level, and it has to
 *   see the source before the React plugin transforms JSX.
 * - `nitro()` is what makes `vite build` produce a deployable server. On
 *   Vercel it emits the Functions/Fluid-compute layout the platform detects
 *   natively; locally it gives `node .output/server/index.mjs`.
 * - Vitest does NOT read this file (see vitest.config.ts) — tests run on the
 *   plain Node pipeline they always ran on, so the 172 of them neither know
 *   nor care which framework serves the app.
 */
export default defineConfig({
  plugins: [tsConfigPaths(), tanstackStart(), nitro(), react()],
});
