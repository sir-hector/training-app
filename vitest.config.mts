import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Pure-function modules only for now. Switch to jsdom per-file with
    // `// @vitest-environment jsdom` when component tests arrive.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
