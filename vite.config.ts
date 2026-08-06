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
  // `loadEnv` reads .env files; on Vercel's CI the values arrive in
  // process.env instead, so both sources merge here — files win locally.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

  return {
    plugins: [tsConfigPaths(), tanstackStart(), nitro(), react()],

    /*
      ── Bind where the browser actually looks ─────────────────────────────

      Without this, `pnpm dev` printed `Local: http://localhost:3000/` while
      serving nothing a browser could reach, and the failure looked like the
      app was broken.

      What happens: another process on this machine holds `*:3000` — the IPv6
      wildcard, which on macOS also answers IPv4. Vite's default host is
      `localhost`, which Node resolves to `::1`, and `::1` specifically was
      still free — so Vite bound it, reported success, and every request from
      Chrome went to the OTHER server, which replied `404 page not found`.
      `curl localhost:3000` reached Vite and the browser did not, because the
      two resolve `localhost` differently.

      `host: "127.0.0.1"` makes the dev server ask for the same address the
      browser will use. If something already holds it, the bind FAILS and the
      terminal says so, which is the whole point: a port conflict should be an
      error, not a server that half exists.

      `strictPort` is the second half. Vite's default is to silently move to
      the next free port, which is friendly right up until a bookmark, an
      OAuth redirect URI or a `next=` parameter points at the old one.
    */
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
    },

    /*
      ── React in its own chunk ────────────────────────────────────────────

      Not a byte saved: the browser downloads the same code either way. What
      changes is WHEN, and how often.

      React and react-dom are the largest single thing in the client bundle
      and the least likely to change — they move when the dependency is
      bumped, which is a few times a year, while the app chunk changes on
      every deploy. Sharing one chunk meant every deploy invalidated both, so
      a returning visitor re-downloaded a framework that had not moved.

      It also puts the app chunk back under Vite's 500 kB advisory, which
      matters less than the caching but is why the warning appeared: the
      warning measures chunks, and one chunk held everything.

      `scheduler` travels with them — it is React's own dependency and pinned
      to it, so splitting them apart would produce two chunks that always
      invalidate together.
    */
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react/") ||
              id.includes("node_modules/scheduler/")
            ) {
              return "react";
            }
          },
        },
      },
    },
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      ),
    },
  };
});
