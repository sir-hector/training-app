import "dotenv/config";
import { defineConfig } from "drizzle-kit";

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
