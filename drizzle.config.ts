import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local automatically; drizzle-kit does not. Load it here
// so `npm run db:*` works locally. CI/deploy pass DATABASE_URL via env.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // `drizzle-kit generate` works without a DB. `migrate` / `push` need DATABASE_URL.
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
