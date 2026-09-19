"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** How often an already-open page re-fetches its server data on its own, while visible. */
const POLL_INTERVAL_MS = 20_000;
/** Floor between any two refreshes, whichever mechanism triggers them — keeps rapid tab-switching from stacking refetches on top of the poll. */
const MIN_GAP_MS = 3_000;

/**
 * Every dashboard is server-rendered once and there's no live sync between
 * sessions (Notifications is the only place with a Realtime subscription) —
 * a change made elsewhere (e.g. a Super Admin updating the NOC/PPT/Problem
 * Statement deadline in Configuration, or an admin assigning a room in Rooms
 * and Venues) never appears in an already-open page (the admin's own NOC/PPT
 * views, or a team's dashboard) without a manual refresh.
 *
 * This silently re-fetches the page's server data two ways: whenever the
 * page regains visibility (switching back to its tab), and on a plain
 * interval while it stays visible — tab-switching alone doesn't cover two
 * windows left open side by side (neither ever "regains" visibility, since
 * neither was hidden) or someone who just leaves one page open all day
 * without ever navigating away, and manually reloading isn't something
 * hundreds of concurrent users can be expected to remember to do. Both
 * paths share one throttle so they can't stack refetches back to back.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    lastRefresh.current = Date.now();

    function refreshIfDue() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < MIN_GAP_MS) return;
      lastRefresh.current = now;
      router.refresh();
    }

    document.addEventListener("visibilitychange", refreshIfDue);
    const interval = setInterval(refreshIfDue, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfDue);
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
