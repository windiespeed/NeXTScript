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
  ]),
  {
    // Existing code has ~120 `any`s, mostly on Google API payloads and the session.
    // Warn for now so CI can gate on real errors; tighten back to "error" as they're typed.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // React Compiler rules added in eslint-config-next 16. The existing code predates them
      // (setState in effects, components defined inside components). Each needs a small
      // refactor, so warn for now and fix them as those files are touched.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
