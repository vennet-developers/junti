import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * The lint that survived the framework.
 *
 * `eslint-config-next` left with Next itself in the migration's final phase.
 * What this keeps is the part of that preset the codebase actually leaned
 * on: the TypeScript recommendations and the rules-of-hooks — the two rule
 * sets whose findings ever changed a line here. The Next-specific rules
 * (no-img-element, no-head-element) died with the framework whose components
 * they were advertising.
 */
const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    /*
      Design source, not app source. `source/visual-identity` holds the brand
      deliverables as they were handed over; linting somebody else's build
      output produces findings nobody can act on.
    */
    "source/**",
    // Build artifacts: Nitro's local output, its Vercel Build-Output-API
    // layout, and the generated route tree.
    ".output/**",
    ".nitro/**",
    ".vercel/**",
    "src/routeTree.gen.ts",
  ]),
  {
    rules: {
      /*
        Warn, not error — the calibration the old preset had. Underscore
        prefixes stay the way to say "unused on purpose", which the ported
        server modules use for retired parameters.
      */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
