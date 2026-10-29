"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/today";

function readCookie(name: string): string | undefined {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/**
 * Keeps the `tz` cookie equal to the browser's timezone so server pages can
 * compute "today" for the user. Re-renders once when it changes (first visit,
 * travel, DST-irrelevant since the IANA name stays the same).
 */
export function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || readCookie(TZ_COOKIE) === tz) return;
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
