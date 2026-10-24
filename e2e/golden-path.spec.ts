import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import { clearTestWorkouts } from "./test-user";

config({ path: [".env.local", ".env"], quiet: true });

test.beforeEach(async () => {
  await clearTestWorkouts();
});

// A month far from "now" so the test never collides with real data and the
// grid is stable regardless of when CI runs.
const MONTH = "2031-03";
const DAY = "2031-03-12";

test("sign in → add a workout → mark done → survives reload", async ({ page }) => {
  // Anonymous visitors are bounced; with the session cookie we land on the calendar.
  await page.goto(`/app?month=${MONTH}`);
  await expect(page.getByRole("heading", { name: "March 2031" })).toBeVisible();

  const cell = page.getByRole("gridcell", { name: new RegExp(`^${DAY},`) });
  await expect(cell).toHaveAccessibleName(`${DAY}, 0 workouts`);

  // Click a day → fill the dialog → save.
  await cell.click();
  const dialog = page.getByRole("dialog", { name: "Add workout" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: "Intervals" }).click();
  await dialog.getByRole("textbox", { name: "Notes" }).fill("6 × 800m @ 3:10, 2' rest");
  await dialog.getByRole("button", { name: "Add workout" }).click();
  await expect(dialog).toBeHidden();

  // The workout renders on the day.
  await expect(cell).toHaveAccessibleName(`${DAY}, 1 workout`);
  const toggle = cell.getByRole("checkbox", { name: "Mark Intervals as done" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // Mark done, and wait for the server action to settle before reloading.
  await toggle.click();
  const doneToggle = cell.getByRole("checkbox", { name: "Mark Intervals as not done" });
  await expect(doneToggle).toHaveAttribute("aria-checked", "true");
  await expect(doneToggle).not.toHaveAttribute("aria-busy", "true");

  // Reload: still there, still done.
  await page.reload();
  const reloadedCell = page.getByRole("gridcell", { name: new RegExp(`^${DAY},`) });
  await expect(reloadedCell).toHaveAccessibleName(`${DAY}, 1 workout`);
  await expect(
    reloadedCell.getByRole("checkbox", { name: "Mark Intervals as not done" }),
  ).toHaveAttribute("aria-checked", "true");
});

test("anonymous visitors are redirected to sign-in", async ({ browser }) => {
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await anon.newPage();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/\?callbackUrl=%2Fapp$/);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await anon.close();
});
