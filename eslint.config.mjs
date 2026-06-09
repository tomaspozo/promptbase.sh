// Flat config for the TanStack Start app (Next.js presets removed during the
// migration). Uses the TypeScript parser so .ts/.tsx parse cleanly; rules are
// intentionally light — `vite build` is the real correctness gate.
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules",
      "dist",
      ".output",
      ".tanstack",
      "src/routeTree.gen.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
];
