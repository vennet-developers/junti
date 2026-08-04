/**
 * Tripwire: the replacement for Next's `server-only` package.
 *
 * The 21 modules that used to open with `import "server-only"` open with this
 * instead. Same contract — importing one from browser code fails loudly — but
 * enforced by us rather than by a package that only works inside React Server
 * Components: under Vite there is no `react-server` condition, so the original
 * package would have thrown on the SERVER too, which is the one place this
 * code belongs.
 *
 * The runtime check is the first line of defence; the second is
 * `scripts/check-client-bundle.mjs`, which fails the build if any of these
 * modules' fingerprints show up in a client chunk. Next enforced this at
 * compile time, so the migration keeps both halves of that guarantee: crash
 * in dev, fail in CI.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "[server-only] A server module was imported by the client bundle. " +
      "Móvelo a un import de servidor (loader, server function, route handler) " +
      "o extrae la parte compartida a un módulo sin secretos.",
  );
}

export {};
