import { cookies } from "next/headers";
import { DEFAULT_TIME_ZONE, TZ_COOKIE, isValidTimeZone, todayIn } from "./index";

/** The signed-in browser's timezone, from the cookie TimeZoneSync maintains. */
export async function getUserTimeZone(): Promise<string> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  const decoded = value ? decodeURIComponent(value) : undefined;
  return isValidTimeZone(decoded) ? decoded : DEFAULT_TIME_ZONE;
}

/** Today's date ("YYYY-MM-DD") in the user's timezone. */
export async function getToday(now: Date = new Date()): Promise<string> {
  return todayIn(await getUserTimeZone(), now);
}
