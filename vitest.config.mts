import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Integration tests read DATABASE_URL. Load .env.local like Next.js does.
config({ path: [".env.local", ".env"], quiet: true });

const integration = process.env.VITEST_INTEGRATION === "1";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // Unit tests: *.test.ts. Integration tests (need a database):
    // *.integration.test.ts, run with `npm run test:integration`.
    include: integration ? ["src/**/*.integration.test.ts"] : ["src/**/*.test.ts"],
    exclude: integration ? [] : ["**/*.integration.test.ts", "**/node_modules/**"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
