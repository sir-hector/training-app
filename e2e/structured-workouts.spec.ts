import { config } from "dotenv";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { clearTestWorkouts } from "./test-user";

config({ path: [".env.local", ".env"], quiet: true });

test.beforeEach(async () => {
  await clearTestWorkouts();
});

// Far from "now" (and from the golden-path month) so the grid is stable.
const MONTH = "2031-04";
const DAY = "2031-04-15";

async function openAddDialog(page: Page): Promise<{ cell: Locator; dialog: Locator }> {
  await page.goto(`/app?month=${MONTH}`);
  await expect(page.getByRole("heading", { name: "April 2031" })).toBeVisible();
  const cell = page.getByRole("gridcell", { name: new RegExp(`^${DAY},`) });
  await cell.click();
  const dialog = page.getByRole("dialog", { name: "Add workout" });
  await expect(dialog).toBeVisible();
  return { cell, dialog };
}

async function pickType(page: Page, dialog: Locator, label: string) {
  await dialog.getByRole("combobox", { name: "Type" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("add a gym workout with two exercises → card summary → reopens filled in", async ({
  page,
}) => {
  const { cell, dialog } = await openAddDialog(page);
  await pickType(page, dialog, "Gym");

  // Collapsed by default.
  await expect(dialog.getByRole("textbox", { name: "Exercise 1 name" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Add details" }).click();

  await dialog.getByRole("textbox", { name: "Exercise 1 name" }).fill("Back squat");
  await dialog.getByRole("spinbutton", { name: "Exercise 1, set 1 reps" }).fill("5");
  await dialog.getByRole("spinbutton", { name: "Exercise 1, set 1 weight (kg)" }).fill("100");
  // A new set copies the previous one.
  await dialog.getByRole("button", { name: "Add set to exercise 1" }).click();
  await expect(dialog.getByRole("spinbutton", { name: "Exercise 1, set 2 reps" })).toHaveValue("5");

  await dialog.getByRole("button", { name: "Add exercise" }).click();
  await dialog.getByRole("textbox", { name: "Exercise 2 name" }).fill("Pull-up");
  await dialog.getByRole("spinbutton", { name: "Exercise 2, set 1 reps" }).fill("8");

  await dialog.getByRole("button", { name: "Add workout" }).click();
  await expect(dialog).toBeHidden();

  const edit = cell.getByRole("button", { name: "Edit Gym · 2 ex · 3 sets" });
  await expect(edit).toBeAttached();

  await page.reload();
  const reloadedCell = page.getByRole("gridcell", { name: new RegExp(`^${DAY},`) });
  const reloadedEdit = reloadedCell.getByRole("button", { name: "Edit Gym · 2 ex · 3 sets" });
  await expect(reloadedEdit).toBeAttached();

  // The edit button is visually hidden on phones (the whole card is the tap
  // target there), so activate it from the keyboard on every viewport.
  await reloadedEdit.press("Enter");
  const editDialog = page.getByRole("dialog", { name: "Edit workout" });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByRole("textbox", { name: "Exercise 1 name" })).toHaveValue(
    "Back squat",
  );
  await expect(
    editDialog.getByRole("spinbutton", { name: "Exercise 1, set 2 weight (kg)" }),
  ).toHaveValue("100");
  await expect(editDialog.getByRole("textbox", { name: "Exercise 2 name" })).toHaveValue("Pull-up");
  await expect(editDialog.getByRole("spinbutton", { name: "Exercise 2, set 1 reps" })).toHaveValue(
    "8",
  );
});

test("invalid details are rejected with field errors", async ({ page }) => {
  const { cell, dialog } = await openAddDialog(page);
  await pickType(page, dialog, "Gym");
  await dialog.getByRole("button", { name: "Add details" }).click();
  await dialog.getByRole("textbox", { name: "Exercise 1 name" }).fill("Deadlift");
  // Reps left empty.
  await dialog.getByRole("button", { name: "Add workout" }).click();

  await expect(dialog.getByText("Enter reps")).toBeVisible();
  const reps = dialog.getByRole("spinbutton", { name: "Exercise 1, set 1 reps" });
  await expect(reps).toHaveAttribute("aria-invalid", "true");

  await reps.fill("3");
  await dialog.getByRole("button", { name: "Add workout" }).click();
  await expect(dialog).toBeHidden();
  await expect(cell.getByRole("button", { name: "Edit Gym · 1 ex · 1 set" })).toBeAttached();
});

test("switching to a type with a different format drops the details", async ({ page }) => {
  const { dialog } = await openAddDialog(page);
  await pickType(page, dialog, "Gym");
  await dialog.getByRole("button", { name: "Add details" }).click();
  await dialog.getByRole("textbox", { name: "Exercise 1 name" }).fill("Squat");

  await pickType(page, dialog, "Run");
  await expect(dialog.getByRole("status")).toHaveText(
    "Gym details were removed: Run uses a different format.",
  );
  await expect(dialog.getByRole("textbox", { name: "Exercise 1 name" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Add details" }).click();
  await dialog.getByRole("spinbutton", { name: "Distance (km)" }).fill("18");
  await dialog.getByRole("button", { name: "Add workout" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit Run · 18 km" })).toBeAttached();
});
