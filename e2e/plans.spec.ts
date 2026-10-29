import { config } from "dotenv";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { clearTestPlans, clearTestWorkouts } from "./test-user";

config({ path: [".env.local", ".env"], quiet: true });

test.beforeEach(async () => {
  await clearTestWorkouts();
  await clearTestPlans();
});

async function pickType(page: Page, dialog: Locator, label: string) {
  await dialog.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function openAdd(page: Page, day: string): Promise<Locator> {
  await page.getByRole("button", { name: `Add workout to ${day}` }).click();
  const dialog = page.getByRole("dialog", { name: "Add plan workout" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("create a 2-week plan, apply it from a Monday, workouts land on the right days", async ({
  page,
}) => {
  // Reachable from the calendar header.
  await page.goto("/app");
  await page.getByRole("link", { name: "Plans" }).click();
  await expect(page.getByRole("heading", { name: "Plans", level: 1 })).toBeVisible();

  await page.getByLabel("Plan name").fill("E2E 10k block");
  await page.getByLabel("Weeks").fill("2");
  await page.getByRole("button", { name: "Create plan" }).click();
  await expect(page).toHaveURL(/\/app\/plans\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "E2E 10k block" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Week \d/ })).toHaveCount(2);

  // Week 1 Monday: gym with structure.
  let dialog = await openAdd(page, "Week 1, Monday");
  await expect(dialog.getByText("Week 1 · Monday")).toBeVisible();
  await pickType(page, dialog, "Gym");
  await dialog.getByRole("button", { name: "Add details" }).click();
  await dialog.getByRole("textbox", { name: "Exercise 1 name" }).fill("Back squat");
  await dialog.getByRole("spinbutton", { name: "Exercise 1, set 1 reps" }).fill("5");
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page
      .getByRole("group", { name: "Week 1, Monday" })
      .getByRole("button", { name: "Edit Gym · 1 ex · 1 set" }),
  ).toBeVisible();

  // Week 1 Wednesday: intervals with notes only.
  dialog = await openAdd(page, "Week 1, Wednesday");
  await pickType(page, dialog, "Intervals");
  await dialog.getByLabel("Notes").fill("track session");
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(dialog).toBeHidden();

  // Week 2 Sunday: long run, 18 km.
  dialog = await openAdd(page, "Week 2, Sunday");
  await pickType(page, dialog, "Long run");
  await dialog.getByRole("button", { name: "Add details" }).click();
  await dialog.getByRole("spinbutton", { name: "Distance (km)" }).fill("18");
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("2 weeks · 3 workouts")).toBeVisible();

  // Edit reopens filled in.
  await page
    .getByRole("group", { name: "Week 1, Wednesday" })
    .getByRole("button", { name: "Edit Intervals: track session" })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit plan workout" });
  await expect(edit.getByLabel("Notes")).toHaveValue("track session");
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toBeHidden();

  // Apply from a Wednesday: snaps to that week's Monday, 2032-02-02.
  await page.getByRole("button", { name: "Apply to calendar" }).click();
  const apply = page.getByRole("dialog", { name: "Apply to calendar" });
  await apply.getByLabel("Start date").fill("2032-02-04");
  await expect(apply.getByText("Starts Mon 2 Feb 2032, the Monday of that week.")).toBeVisible();
  await expect(apply.getByTestId("apply-from")).toHaveText("Mon 2 Feb 2032");
  await expect(apply.getByTestId("apply-to")).toHaveText("Sun 15 Feb 2032");
  await expect(apply.getByTestId("apply-count")).toHaveText("3 workouts over 2 weeks");
  await expect(apply.getByText("Checking your calendar…")).toBeHidden();
  await expect(apply.getByTestId("apply-skipped")).toBeHidden();
  await apply.getByRole("button", { name: "Add 3 workouts" }).click();

  const applied = page.getByRole("dialog", { name: "Plan applied" });
  await expect(applied.getByTestId("apply-result")).toHaveText(
    "Added 3 workouts. Mon 2 Feb 2032 to Sun 15 Feb 2032.",
  );
  await applied.getByRole("link", { name: "Open February 2032" }).click();

  await expect(page).toHaveURL(/\/app\?month=2032-02$/);
  await expect(page.getByRole("heading", { name: "February 2032" })).toBeVisible();
  const cell = (iso: string) => page.getByRole("gridcell", { name: new RegExp(`^${iso},`) });
  await expect(cell("2032-02-02")).toHaveAccessibleName("2032-02-02, 1 workout");
  await expect(
    cell("2032-02-02").getByRole("button", { name: "Edit Gym · 1 ex · 1 set" }),
  ).toBeAttached();
  await expect(
    cell("2032-02-04").getByRole("button", { name: "Edit Intervals: track session" }),
  ).toBeAttached();
  await expect(
    cell("2032-02-15").getByRole("button", { name: "Edit Long run · 18 km" }),
  ).toBeAttached();
  // Nothing anywhere else in the visible grid.
  await expect(page.getByRole("gridcell", { name: /, [1-9]\d* workouts?$/ })).toHaveCount(3);
});

test("re-applying a plan skips workouts already on the calendar", async ({ page }) => {
  await page.goto("/app/plans");
  await page.getByLabel("Plan name").fill("E2E repeat block");
  await page.getByLabel("Weeks").fill("1");
  await page.getByRole("button", { name: "Create plan" }).click();
  await expect(page.getByRole("heading", { name: "E2E repeat block" })).toBeVisible();

  let dialog = await openAdd(page, "Week 1, Monday");
  await pickType(page, dialog, "Run");
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(dialog).toBeHidden();
  dialog = await openAdd(page, "Week 1, Thursday");
  await pickType(page, dialog, "Gym");
  await dialog.getByRole("button", { name: "Add to plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("1 week · 2 workouts")).toBeVisible();

  // First apply: nothing there yet.
  await page.getByRole("button", { name: "Apply to calendar" }).click();
  let apply = page.getByRole("dialog", { name: "Apply to calendar" });
  await apply.getByLabel("Start date").fill("2032-03-01");
  await expect(apply.getByText("Checking your calendar…")).toBeHidden();
  await apply.getByRole("button", { name: "Add 2 workouts" }).click();
  let applied = page.getByRole("dialog", { name: "Plan applied" });
  await expect(applied.getByTestId("apply-result")).toHaveText(
    "Added 2 workouts. Mon 1 Mar 2032 to Sun 7 Mar 2032.",
  );
  await applied.getByRole("button", { name: "Close" }).first().click();
  await expect(applied).toBeHidden();

  // Same start again: everything is already there, so nothing can be added.
  await page.getByRole("button", { name: "Apply to calendar" }).click();
  apply = page.getByRole("dialog", { name: "Apply to calendar" });
  await apply.getByLabel("Start date").fill("2032-03-01");
  await expect(apply.getByTestId("apply-skipped")).toHaveText(
    "2 already on your calendar will be skipped.",
  );
  await expect(apply.getByTestId("apply-count")).toHaveText("0 workouts over 1 week");
  await expect(apply.getByTestId("apply-nothing")).toBeVisible();
  await expect(apply.getByRole("button", { name: "Nothing to add" })).toBeDisabled();

  // A different Monday is free again.
  await apply.getByLabel("Start date").fill("2032-03-08");
  await expect(apply.getByTestId("apply-count")).toHaveText("2 workouts over 1 week");
  await expect(apply.getByTestId("apply-skipped")).toBeHidden();
  await expect(apply.getByTestId("apply-nothing")).toBeHidden();
  await apply.getByRole("button", { name: "Add 2 workouts" }).click();
  applied = page.getByRole("dialog", { name: "Plan applied" });
  await expect(applied.getByTestId("apply-result")).toHaveText(
    "Added 2 workouts. Mon 8 Mar 2032 to Sun 14 Mar 2032.",
  );
  await applied.getByRole("link", { name: "Open March 2032" }).click();

  // Exactly one copy of each on both weeks.
  await expect(page.getByRole("heading", { name: "March 2032" })).toBeVisible();
  const cell = (iso: string) => page.getByRole("gridcell", { name: new RegExp(`^${iso},`) });
  for (const iso of ["2032-03-01", "2032-03-04", "2032-03-08", "2032-03-11"]) {
    await expect(cell(iso)).toHaveAccessibleName(`${iso}, 1 workout`);
  }
  await expect(page.getByRole("gridcell", { name: /, [1-9]\d* workouts?$/ })).toHaveCount(4);
});

test("another user's (or a missing) plan is a 404", async ({ page }) => {
  const res = await page.goto("/app/plans/00000000-0000-4000-8000-000000000000");
  expect(res?.status()).toBe(404);
  const bad = await page.goto("/app/plans/not-a-uuid");
  expect(bad?.status()).toBe(404);
});

test("anonymous visitors are redirected from plans", async ({ browser }) => {
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await anon.newPage();
  await page.goto("/app/plans");
  await expect(page).toHaveURL(/\/\?callbackUrl=%2Fapp%2Fplans$/);
  await anon.close();
});
