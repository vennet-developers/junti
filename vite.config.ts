import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
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
export default defineConfig(({ mode }) => {
  /*
    Next injected NEXT_PUBLIC_* into client code as `process.env.X`; Vite only
    exposes its own prefix, through `import.meta.env`. Rather than rename the
    variables in every environment (local, Vercel, the docs), define the two
    the browser actually needs. They are publishable by design — the anon key
    and the project URL — which is the only reason a define is acceptable.
  */
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [tsConfigPaths(), tanstackStart(), nitro(), react()],
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      ),
    },
  };
});
