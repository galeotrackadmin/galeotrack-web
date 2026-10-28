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
    "test-results/**",
    "test-results-pwa/**",
    "playwright-report/**",
    "next-env.d.ts",
    "public/sw.js",
    "supabase/functions/**",
    ".agents/**",
    ".opencode/**",
  ]),
]);

export default eslintConfig;
