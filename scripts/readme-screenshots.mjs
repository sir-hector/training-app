/**
 * Regenerates the README screenshots against a running app (default
 * http://localhost:3000). Uses a throwaway demo user so no real data
 * appears in the images, and deletes it afterwards.
 *
 *   npm run dev            # in another terminal
 *   npm run screenshots
 */
import { config } from "dotenv";
import { chromium, devices } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { addDays, format, startOfMonth, addMonths } from "date-fns";

config({ path: [".env.local", ".env"], quiet: true });

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const USER = "demo-readme";
const sql = neon(process.env.DATABASE_URL);

const today = new Date();
const monthParam = format(today, "yyyy-MM");
const emptyMonth = format(addMonths(today, 2), "yyyy-MM");

// A believable two-week block around today: past days done, future planned.
const pattern = [
  ["gym"],
  ["interval"],
  ["mobility"],
  ["tempo"],
  [],
  ["long_run", "mobility"],
  [],
  ["strength"],
  ["run"],
  ["bike"],
  ["interval"],
  [],
  ["long_run"],
  [],
];
const notes = {
  gym: "Upper body + core",
  interval: "6 × 800m @ 3:10, 2' jog",
  mobility: "20 min hips + ankles",
  tempo: "3 km WU, 5 km @ 4:15, CD",
  long_run: "18 km easy, last 3 steady",
  strength: "Squat 5×5, RDL 3×8",
  run: "8 km easy",
  bike: "60 min Z2 on the trainer",
};

async function seed() {
  await sql`delete from users where id = ${USER}`;
  await sql`insert into users (id, name, email) values (${USER}, 'Demo Runner', 'demo@test.invalid')`;
  const start = addDays(today, -6);
  for (let i = 0; i < pattern.length; i++) {
    const date = addDays(start, i);
    const done = date < today;
    for (const type of pattern[i]) {
      await sql`insert into workouts (user_id, date, type, notes, done, completed_at)
        values (${USER}, ${format(date, "yyyy-MM-dd")}, ${type}, ${notes[type]}, ${done}, ${done ? date : null})`;
    }
  }
  // A couple of entries earlier in the month so the grid doesn't look sparse.
  const first = startOfMonth(today);
  for (const [offset, type] of [
    [1, "run"],
    [3, "gym"],
    [5, "long_run"],
  ]) {
    const date = addDays(first, offset);
    if (date >= addDays(today, -6)) continue;
    await sql`insert into workouts (user_id, date, type, notes, done, completed_at)
      values (${USER}, ${format(date, "yyyy-MM-dd")}, ${type}, ${notes[type]}, true, ${date})`;
  }
  const token = crypto.randomUUID();
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${USER}, ${addDays(today, 1)})`;
  return token;
}

async function main() {
  const token = await seed();
  const browser = await chromium.launch();
  const cookie = {
    name: "authjs.session-token",
    value: token,
    domain: new URL(BASE).hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  };
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1200, height: 860 },
      deviceScaleFactor: 2,
      colorScheme: "light",
    });
    await desktop.addCookies([cookie]);
    const page = await desktop.newPage();

    await page.goto(`${BASE}/app?month=${monthParam}`);
    await page.getByRole("grid").waitFor();
    await page.screenshot({ path: `${OUT}/calendar-populated.png` });

    await page.goto(`${BASE}/app?month=${emptyMonth}`);
    await page.getByRole("grid").waitFor();
    await page.screenshot({ path: `${OUT}/calendar-empty.png` });

    await page.goto(`${BASE}/app?month=${monthParam}`);
    await page
      .getByRole("button", { name: /^Edit Tempo/ })
      .first()
      .click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/edit-dialog.png` });

    const dark = await browser.newContext({
      viewport: { width: 1200, height: 860 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
    });
    await dark.addCookies([cookie]);
    const darkPage = await dark.newPage();
    await darkPage.goto(`${BASE}/app?month=${monthParam}`);
    await darkPage.getByRole("grid").waitFor();
    await darkPage.screenshot({ path: `${OUT}/calendar-dark.png` });

    const mobile = await browser.newContext({ ...devices["iPhone 13"], colorScheme: "light" });
    await mobile.addCookies([cookie]);
    const phone = await mobile.newPage();
    await phone.goto(`${BASE}/app?month=${monthParam}`);
    await phone.getByRole("grid").waitFor();
    await phone.screenshot({ path: `${OUT}/calendar-mobile.png` });

    const anon = await browser.newContext({
      viewport: { width: 1200, height: 700 },
      deviceScaleFactor: 2,
    });
    const home = await anon.newPage();
    await home.goto(BASE);
    await home.getByRole("button", { name: "Sign in with Google" }).waitFor();
    await home.screenshot({ path: `${OUT}/sign-in.png` });
  } finally {
    await browser.close();
    await sql`delete from users where id = ${USER}`;
  }
  console.log(`Screenshots written to ${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
