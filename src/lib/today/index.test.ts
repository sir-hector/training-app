import { describe, expect, it } from "vitest";
import { isValidTimeZone, todayIn } from "./index";

describe("todayIn", () => {
  // 22:30 UTC on 23 Oct 2026 is already 24 Oct in Poland (CEST, UTC+2).
  const lateUtc = new Date("2026-10-23T22:30:00Z");

  it("uses the given timezone, not UTC", () => {
    expect(todayIn("UTC", lateUtc)).toBe("2026-10-23");
    expect(todayIn("Europe/Warsaw", lateUtc)).toBe("2026-10-24");
    expect(todayIn("America/Los_Angeles", lateUtc)).toBe("2026-10-23");
  });

  it("handles winter time (CET, UTC+1) after the DST switch", () => {
    // 23:30 UTC on 1 Nov 2026 is 00:30 on 2 Nov in Warsaw.
    expect(todayIn("Europe/Warsaw", new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02");
    expect(todayIn("Europe/Warsaw", new Date("2026-11-01T22:30:00Z"))).toBe("2026-11-01");
  });

  it("crosses a year boundary", () => {
    expect(todayIn("Asia/Tokyo", new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });

  it("falls back to UTC for an invalid timezone", () => {
    expect(todayIn("Not/AZone", lateUtc)).toBe("2026-10-23");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("Europe/Warsaw")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone("x".repeat(65))).toBe(false);
  });
});
