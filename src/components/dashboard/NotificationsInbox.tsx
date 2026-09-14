"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { NotificationRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const FROM_LABEL: Record<string, string> = {
  "Super Admin": "Super Admin",
  "Campus Admin": "Campus Admin",
  SPOC: "SPOC",
  "Zone Manager": "Zone Manager",
};
/** sender_role is null for system-generated notifications (NOC uploaded, exit decisions, ...). */
const SYSTEM_KEY = "__system__";

/**
 * Every notification addressed to this person, newest first (already
 * ordered server-side) — shared by the team dashboard and every admin/SPOC/
 * Zone Manager role so the viewing experience is identical everywhere,
 * regardless of whether that role can also send. Live-updates via Supabase
 * Realtime. The list shows a one-line preview; clicking opens the full
 * message in a modal and marks it read.
 *
 * `onMarkRead` is injected rather than imported directly, since the team
 * and admin sides each have their own thin RPC wrapper
 * (team-actions/admin-actions) calling the same mark_notification_read RPC.
 */
export function NotificationsInbox({
  profileId,
  notifications,
  onMarkRead,
}: {
  profileId: string;
  notifications: NotificationRow[];
  onMarkRead: (notificationId: string) => Promise<unknown>;
}) {
  const [local, setLocal] = useState(notifications);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [fromFilter, setFromFilter] = useState("any");

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

  async function handleOpen(n: NotificationRow) {
    setOpenId(n.id);
    if (n.read) return;
    setPendingId(n.id);
    try {
      await onMarkRead(n.id);
      setLocal((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    } finally {
      setPendingId(null);
    }
  }

  const openNotification = openId ? (local.find((n) => n.id === openId) ?? null) : null;

  const fromKeysPresent = useMemo(
    () => Array.from(new Set(local.map((n) => n.sender_role ?? SYSTEM_KEY))),
    [local],
  );
  const visible = fromFilter === "any" ? local : local.filter((n) => (n.sender_role ?? SYSTEM_KEY) === fromFilter);

  if (local.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No notifications yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fromKeysPresent.length > 1 && (
        <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
          From
          <select
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            className="w-fit rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
          >
            <option value="any">Everyone</option>
            {fromKeysPresent.map((key) => (
              <option key={key} value={key}>
                {key === SYSTEM_KEY ? "System" : (FROM_LABEL[key] ?? key)}
              </option>
            ))}
          </select>
        </label>
      )}

      {visible.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No notifications match this filter.</p>
        </div>
      )}

      {visible.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => handleOpen(n)}
          disabled={pendingId === n.id}
          className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${
            n.read ? "border-border bg-surface" : "border-gold/40 bg-gold/5"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading text-sm font-semibold text-ink">{n.title}</p>
            {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />}
          </div>
          <p className="mt-1 line-clamp-1 font-heading text-sm text-ink-muted">{n.message}</p>
          <p className="mt-2 font-mono text-xs text-ink-faint">
            {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </button>
      ))}

      {openNotification && <MessageModal notification={openNotification} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** Minimal shape so this also works for NotificationBroadcastRow ("Sent" tab), not just NotificationRow. */
export function MessageModal({
  notification,
  onClose,
}: {
  notification: { title: string; message: string; created_at: string };
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <h2 className="font-display text-xl text-ink">{notification.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-border px-4 py-2 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <p className="font-heading text-sm whitespace-pre-wrap text-ink-muted">{notification.message}</p>
          <p className="mt-4 font-mono text-xs text-ink-faint">
            {new Date(notification.created_at).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
