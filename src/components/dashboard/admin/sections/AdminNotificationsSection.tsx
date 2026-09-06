"use client";

import { useEffect, useState } from "react";
import type { NotificationRow, UserRole } from "@/types/database";
import {
  markNotificationRead,
  broadcastNotification,
  DashboardActionError,
  type BroadcastRoleFilter,
} from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { createClient } from "@/lib/supabase/client";

type View = "all" | "by-status";

/**
 * Who each role may notify (server-enforced in broadcast_notification via
 * can_notify_target). The sender's *area* is implicit — a Campus Admin
 * reaches their campus, a Zone Manager their zone(s), a SPOC their room(s) —
 * so the compose box is just a role picker.
 *   Super Admin  -> Campus Admin / SPOC / Zone Manager / Team Lead / Member (any campus)
 *   Campus Admin -> SPOC / Zone Manager / Team Lead / Member (own campus)
 *   Zone Manager -> SPOC + Team Leads / Members of their zone
 *   SPOC         -> Team Leads / Members in their room(s)
 *   Team Lead / Member -> receive only, no compose box.
 */
const SENDER_ROLES: Partial<Record<UserRole, BroadcastRoleFilter[]>> = {
  "Super Admin": ["", "Campus Admin", "SPOC", "Zone Manager", "Team Lead", "Member"],
  "Campus Admin": ["", "SPOC", "Zone Manager", "Team Lead", "Member"],
  "Zone Manager": ["", "SPOC", "Team Lead", "Member"],
  SPOC: ["", "Team Lead", "Member"],
};

const ROLE_LABEL: Record<BroadcastRoleFilter, string> = {
  "": "All roles",
  "Campus Admin": "Campus Admins",
  SPOC: "SPOCs",
  "Zone Manager": "Zone Managers",
  "Team Lead": "Team Leads",
  Member: "Members",
};

const REACH_HINT: Partial<Record<UserRole, string>> = {
  "Super Admin": "Reaches the chosen role across every campus.",
  "Campus Admin": "Reaches the chosen role in your campus.",
  "Zone Manager": "Reaches the chosen role in your zone.",
  SPOC: "Reaches the chosen role in your venue(s).",
};

export function AdminNotificationsSection({
  profileId,
  role,
  notifications,
}: {
  profileId: string;
  role: UserRole;
  notifications: NotificationRow[];
}) {
  const [local, setLocal] = useState(notifications);

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

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const fadeRef = useTabFade(view);

  const roleOptions = SENDER_ROLES[role];

  const [roleFilter, setRoleFilter] = useState<BroadcastRoleFilter>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const count = await broadcastNotification(title.trim(), message.trim(), "all", "", roleFilter);
      setSendSuccess(`Sent to ${count} ${count === 1 ? "person" : "people"}.`);
      setTitle("");
      setMessage("");
    } catch (err) {
      setSendError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

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

  function renderItem(n: NotificationRow) {
    return (
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
    );
  }

  const unread = local.filter((n) => !n.read);
  const read = local.filter((n) => n.read);
  const inputClass =
    "rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold";

  return (
    <div className="flex flex-col gap-6">
      {roleOptions && (
        <form onSubmit={handleSend} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Send Notification</span>

          <div className="flex flex-wrap gap-2">
            {roleOptions.map((r) => (
              <button
                key={r || "all"}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`rounded-lg border px-3 py-1.5 font-heading text-xs transition-colors ${
                  roleFilter === r
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border text-ink-muted hover:border-gold hover:text-gold"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="font-heading text-xs text-ink-faint">{REACH_HINT[role]}</p>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className={inputClass}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message"
            rows={3}
            required
            className={inputClass}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sending}
              className="w-fit rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send"}
            </button>
            {sendError && <p className="font-heading text-xs text-danger">{sendError}</p>}
            {sendSuccess && <p className="font-heading text-xs text-gitam">{sendSuccess}</p>}
          </div>
        </form>
      )}

      {local.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ViewToggle
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "By Date" },
              { value: "by-status", label: "By Status" },
            ]}
          />

          <div ref={fadeRef} className="flex flex-col gap-4">
            {view === "all" ? (
              <div className="flex flex-col gap-2">{local.map(renderItem)}</div>
            ) : (
              <>
                <div>
                  <p className="mb-2 font-heading text-xs tracking-[0.2em] text-gold uppercase">
                    Unread ({unread.length})
                  </p>
                  {unread.length === 0 ? (
                    <p className="font-heading text-sm text-ink-muted">Nothing unread.</p>
                  ) : (
                    <div className="flex flex-col gap-2">{unread.map(renderItem)}</div>
                  )}
                </div>
                <div>
                  <p className="mb-2 font-heading text-xs tracking-[0.2em] text-ink-muted uppercase">
                    Read ({read.length})
                  </p>
                  {read.length === 0 ? (
                    <p className="font-heading text-sm text-ink-muted">Nothing read yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">{read.map(renderItem)}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
