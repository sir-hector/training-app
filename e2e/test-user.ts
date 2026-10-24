/**
 * Test identity for e2e runs. Instead of driving Google's OAuth screen
 * (impossible in CI), we create a user + database session directly and hand
 * the browser the session cookie. This is exactly what Auth.js does after a
 * successful Google callback, so the app code under test is unchanged and
 * nothing test-only ships to production.
 */
import { neon } from "@neondatabase/serverless";

// Stable across Playwright's main process and its workers.
export const E2E_USER_ID = `e2e-${process.env.GITHUB_RUN_ID ?? "local"}`;

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set for e2e tests");
  return neon(url);
}

export async function createTestSession(): Promise<string> {
  const db = sql();
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db`insert into users (id, name, email)
    values (${E2E_USER_ID}, 'E2E Tester', ${`${E2E_USER_ID}@test.invalid`})
    on conflict (id) do nothing`;
  await db`insert into sessions (session_token, user_id, expires)
    values (${token}, ${E2E_USER_ID}, ${expires})`;
  return token;
}

export async function deleteTestUser(): Promise<void> {
  // Sessions, workouts and plans cascade.
  await sql()`delete from users where id = ${E2E_USER_ID}`;
}

/** Start each test from an empty calendar for the e2e user. */
export async function clearTestWorkouts(): Promise<void> {
  await sql()`delete from workouts where user_id = ${E2E_USER_ID}`;
}

/** Start each plans test with no plans for the e2e user (plan days cascade). */
export async function clearTestPlans(): Promise<void> {
  await sql()`delete from plans where user_id = ${E2E_USER_ID}`;
}
