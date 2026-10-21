import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  // `next build` evaluates route modules to collect page data but never runs a
  // query. Hand it a placeholder so the build doesn't need a real database.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "postgres://build:build@localhost:5432/build";
  }

  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// The Auth.js Drizzle adapter inspects the instance's class, so this must be
// a real NeonHttpDatabase (not a lazy wrapper). `neon()` does not open a
// connection until the first query.
export const db = drizzle(neon(databaseUrl()), { schema });

export { schema };
