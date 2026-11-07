import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Phase 12 test-server build outputs (tests/setup/global-setup.js,
    // playwright.config.mjs) — same generated-artifact reasoning as
    // ignoring .next/ itself.
    ".next-test/**",
    ".next-e2e-test/**",
  ]),
  {
    rules: {
      // Flags ANY setState reachable from an effect's call graph, sync or
      // async — which means it flags the standard "fetch on mount in a
      // client component" pattern outright (see app/(app)/products/*Tab.jsx),
      // not just the genuinely-risky synchronous-setState-in-render-path
      // case the rule name suggests. This project has no data-fetching
      // library (SWR/React Query) and most future phases' list/filter/CRUD
      // screens need client-side fetching driven by interactive state
      // (search, pagination, tabs) that a server component alone can't
      // provide without a much bigger rearchitecture. Revisit if/when this
      // project adopts the React Compiler or a fetching library.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
