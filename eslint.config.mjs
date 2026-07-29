import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
      Design source, not app source. `source/visual-identity` holds the brand
      deliverables as they were handed over — the interactive brand document
      and the bundled runtime its export tool ships with it. None of it is
      imported by the app or shipped in the bundle, and linting somebody
      else's build output produces ten findings nobody can act on.
    */
    "source/**",
  ]),
]);

export default eslintConfig;
