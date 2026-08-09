"use client";

import { useState } from "react";
import type { NotificationRow } from "@/types/database";
import { markNotificationRead } from "@/lib/dashboard/admin-actions";

/** SPEC §70-72/§75 — SPOC and Super Admin both get notified on new registrations, pending approvals, NOC/Exit Form uploads, etc. */
export function AdminNotificationsSection({ notifications }: { notifications: NotificationRow[] }) {
  const [local, setLocal] = useState(notifications);
  const [pendingId, setPendingId] = useState<string | null>(null);

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
          <p className="mt-2 font-mono text-xs text-ink-faint">{new Date(n.created_at).toLocaleString()}</p>
        </button>
      ))}
    </div>
  );
}
