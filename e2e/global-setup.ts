import { config } from "dotenv";
import type { FullConfig } from "@playwright/test";
import { createTestSession } from "./test-user";

config({ path: [".env.local", ".env"], quiet: true });

export const STORAGE_STATE = "e2e/.auth/state.json";

export default async function globalSetup(cfg: FullConfig) {
  const baseURL = new URL(cfg.projects[0].use.baseURL ?? "http://localhost:3000");
  const token = await createTestSession();
  const secure = baseURL.protocol === "https:";

  const fs = await import("node:fs/promises");
  await fs.mkdir("e2e/.auth", { recursive: true });
  await fs.writeFile(
    STORAGE_STATE,
    JSON.stringify({
      cookies: [
        {
          // Auth.js prefixes the cookie with __Secure- on https.
          name: secure ? "__Secure-authjs.session-token" : "authjs.session-token",
          value: token,
          domain: baseURL.hostname,
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
          httpOnly: true,
          secure,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
}
