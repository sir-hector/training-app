import { expect, test } from "@playwright/test";

/**
 * "Today" must follow the browser's timezone, not the server's UTC clock.
 * UTC+14 and UTC-11 are 25 hours apart, so at any moment they are on
 * different calendar dates: if the server ignored the browser, at least one
 * of these would highlight the wrong day, whatever time CI runs.
 */
for (const timezoneId of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
  test(`today is highlighted in the browser's timezone (${timezoneId})`, async ({ browser }) => {
    const context = await browser.newContext({
      timezoneId,
      storageState: "e2e/.auth/state.json",
    });
    const page = await context.newPage();
    await page.goto("/app");

    const expected = await page.evaluate(() =>
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );

    // First visit stores the timezone cookie and refreshes once.
    await expect
      .poll(() => page.locator('[role="gridcell"][aria-current="date"]').getAttribute("aria-label"))
      .toMatch(new RegExp(`^${expected},`));

    // The default month is the browser's current month too.
    const [y, m] = expected.split("-").map(Number);
    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
    await expect(page.getByRole("heading", { name: `${monthName} ${y}` })).toBeVisible();

    await context.close();
  });
}
