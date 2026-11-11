// Coverage config used for the A-coverage baseline report in docs/coverage-baseline/.
// Extends the main vitest config but measures only first-party source:
// the default config also instruments node_modules (mermaid, katex, …),
// which made up ~64% of the counted lines and distorted the overall number.
//
// Run: yarn vitest run --config vitest.coverage.config.mts
import { defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config.mts";

const merged = mergeConfig(base, defineConfig({}));

merged.test!.coverage = {
  ...merged.test!.coverage,
  enabled: true,
  provider: "v8",
  all: true,
  include: [
    "packages/*/src/**/*.{ts,tsx}",
    "packages/excalidraw/**/*.{ts,tsx}",
    "excalidraw-app/**/*.{ts,tsx}",
  ],
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.d.ts",
    "**/*.test.{ts,tsx}",
    "**/tests/**",
    "**/__tests__/**",
    "**/__snapshots__/**",
  ],
  reporter: ["text", "text-summary", "json-summary", "html"],
  reportsDirectory: "./docs/coverage-baseline",
  thresholds: undefined,
};

export default merged;
