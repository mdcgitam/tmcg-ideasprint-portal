"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Venue tab bar for the Zone Manager's section pages — mirrors the bar on
 * the /dashboard/zone launcher. Links stay on the current section and only
 * swap the `?room` filter; "All venues" clears it.
 */
export function ZoneVenueTabs({ rooms }: { rooms: Array<{ id: string; name: string }> }) {
  const pathname = usePathname();
  const activeRoomId = useSearchParams().get("room") ?? undefined;

  if (rooms.length === 0) return null;

  const base = "rounded-full px-3 py-1 font-heading text-xs transition-colors";
  const on = "bg-gold text-void";
  const off = "border border-border text-ink-muted hover:border-gold hover:text-gold";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="mr-1 font-mono text-xs tracking-[0.2em] text-ink-faint uppercase">Venue</span>
      <Link href={pathname} className={`${base} ${activeRoomId ? off : on}`}>
        All venues
      </Link>
      {rooms.map((r) => (
        <Link
          key={r.id}
          href={`${pathname}?room=${r.id}`}
          className={`${base} ${activeRoomId === r.id ? on : off}`}
        >
          {r.name}
        </Link>
      ))}
    </div>
  );
}
