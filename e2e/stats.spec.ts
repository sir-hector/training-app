import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { format } from "date-fns";
import { addDaysIso, startOfWeekIso } from "../src/lib/workout-stats";
import { E2E_USER_ID, clearTestWorkouts } from "./test-user";

config({ path: [".env.local", ".env"], quiet: true });

test.beforeEach(async () => {
  await clearTestWorkouts();
});

// The page computes "today" from the server's clock, and so does this test
// (same machine locally and in CI). Every date is relative to this week's
// Monday, and each is chosen so the expected numbers hold on any weekday:
// this week's Monday is never after today and its Sunday never before it.
const today = format(new Date(), "yyyy-MM-dd");
const monday = startOfWeekIso(today);
const weeksAgo = (n: number, weekday: number) => addDaysIso(monday, -7 * n + weekday);

const SEED = [
  { date: weeksAgo(0, 0), type: "run", done: true }, // this week, Mon
  { date: weeksAgo(0, 6), type: "gym", done: false }, // this week, Sun: upcoming, not missed
  { date: weeksAgo(1, 2), type: "interval", done: true },
  { date: weeksAgo(1, 3), type: "tempo", done: false }, // missed
  { date: weeksAgo(2, 1), type: "run", done: true },
  // 3 weeks ago: nothing, so the streak is 3 (this week + the two before)
  { date: weeksAgo(5, 4), type: "long_run", done: true }, // outside the last 4 weeks
] as const;

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  for (const w of SEED) {
    await sql`insert into workouts (user_id, date, type, done, completed_at)
      values (${E2E_USER_ID}, ${w.date}, ${w.type}, ${w.done}, ${w.done ? new Date() : null})`;
  }
}

test("stats page shows tiles, weekly chart and type breakdown for seeded workouts", async ({
  page,
}) => {
  await seed();

  // Reachable from the calendar header.
  await page.goto("/app");
  await page.getByRole("link", { name: "Stats" }).click();
  await expect(page).toHaveURL(/\/app\/stats$/);
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();

  // Tiles
  await expect(page.getByRole("region", { name: "This week" })).toContainText("1 / 2");
  const lastFour = page.getByRole("region", { name: "Last 4 weeks" });
  await expect(lastFour).toContainText("75%");
  await expect(lastFour).toContainText("3 of 4 done");
  await expect(page.getByRole("region", { name: "Current streak" })).toContainText("3 weeks");

  // Weekly chart: summary in the accessible name, per-week numbers in the table.
  await expect(page.getByRole("img", { name: /Planned vs done per week/ })).toHaveAccessibleName(
    /4 of 6 workouts done/,
  );
  await page.getByText("Show as table").click();
  const table = page.getByRole("table", { name: "Workouts per week" });
  await expect(table.getByRole("row")).toHaveCount(13); // header + 12 weeks
  const row = (name: RegExp) => table.getByRole("row", { name });
  await expect(row(/this week/).getByRole("cell")).toHaveText(["2", "1"]);
  const weekOf = (n: number) => {
    const d = new Date(`${weeksAgo(n, 0)}T00:00:00Z`);
    return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
  };
  await expect(row(new RegExp(`^${weekOf(1)}\\b`)).getByRole("cell")).toHaveText(["2", "1"]);
  await expect(row(new RegExp(`^${weekOf(2)}\\b`)).getByRole("cell")).toHaveText(["1", "1"]);
  await expect(row(new RegExp(`^${weekOf(3)}\\b`)).getByRole("cell")).toHaveText(["0", "0"]);
  await expect(row(new RegExp(`^${weekOf(5)}\\b`)).getByRole("cell")).toHaveText(["1", "1"]);

  // Type breakdown, labels from workout-types.
  const byType = page.getByRole("region", { name: "By type" });
  const typeRow = (label: string) =>
    byType.getByRole("listitem").filter({ hasText: new RegExp(`^${label}\\d`) });
  await expect(byType.getByRole("listitem")).toHaveCount(5);
  await expect(typeRow("Run")).toContainText("2 / 2");
  await expect(typeRow("Gym")).toContainText("0 / 1");
  await expect(typeRow("Intervals")).toContainText("1 / 1");
  await expect(typeRow("Tempo")).toContainText("0 / 1");
  await expect(typeRow("Long run")).toContainText("1 / 1");

  // And back to the calendar.
  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("stats page redirects anonymous visitors to sign-in", async ({ browser }) => {
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await anon.newPage();
  await page.goto("/app/stats");
  await expect(page).toHaveURL(/\/\?callbackUrl=%2Fapp%2Fstats$/);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await anon.close();
});
