"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Every module opens in its own tab, server-rendered once — there's no live
 * sync between tabs (Notifications is the only place with a Realtime
 * subscription), so a change made in one tab (e.g. assigning a room in Rooms
 * and Venues) never appears in an already-open tab (e.g. Profile) without a
 * manual refresh. This silently re-fetches this tab's server data whenever
 * it regains visibility, so switching back to it picks up changes made
 * elsewhere automatically. Throttled so rapid tab-switching doesn't spam
 * the server with refetches.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    lastRefresh.current = Date.now();

    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < 3000) return;
      lastRefresh.current = now;
      router.refresh();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [router]);

  return null;
}
