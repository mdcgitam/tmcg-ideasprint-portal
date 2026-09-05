"use client";

import { useEffect, useState } from "react";
import type { NotificationRow } from "@/types/database";
import { markNotificationRead } from "@/lib/dashboard/team-actions";
import { createClient } from "@/lib/supabase/client";

/** Every notification addressed to this person — registration updates, approval/exit decisions, NOC/PPT/attendance notices, and anything an admin has broadcast. Live-updates via Supabase Realtime so a new one shows up without a page refresh. */
export function NotificationsSection({
  profileId,
  notifications,
}: {
  profileId: string;
  notifications: NotificationRow[];
}) {
  const [local, setLocal] = useState(notifications);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${profileId}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setLocal((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${profileId}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setLocal((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  async function handleClick(n: NotificationRow) {
    if (n.read) return;
    setPendingId(n.id);
    try {
      await markNotificationRead(n.id);
      setLocal((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } finally {
      setPendingId(null);
    }
  }

  if (local.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No notifications yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {local.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => handleClick(n)}
          disabled={pendingId === n.id}
          className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
            n.read ? "border-border bg-surface" : "border-gold/40 bg-gold/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="font-heading text-sm font-semibold text-ink">{n.title}</p>
            {!n.read && <span className="size-1.5 rounded-full bg-gold" aria-hidden />}
          </div>
          <p className="mt-1 font-heading text-sm text-ink-muted">{n.message}</p>
          <p className="mt-2 font-mono text-xs text-ink-faint">
            {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </button>
      ))}
    </div>
  );
}
