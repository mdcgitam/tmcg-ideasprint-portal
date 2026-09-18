"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Every dashboard is server-rendered once and there's no live sync between
 * sessions (Notifications is the only place with a Realtime subscription) —
 * a change made elsewhere (e.g. a Super Admin updating the NOC/PPT/Problem
 * Statement deadline in Configuration, or an admin assigning a room in Rooms
 * and Venues) never appears in an already-open page (the admin's own NOC/PPT
 * views, or a team's dashboard) without a manual refresh. This silently
 * re-fetches the page's server data whenever it regains visibility, so
 * switching back to it — a different tab for the admin card-grid pages, or
 * just alt-tabbing back for a team's single-page dashboard — picks up
 * changes made elsewhere automatically. Throttled so rapid tab-switching
 * doesn't spam the server with refetches.
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
