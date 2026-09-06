"use client";

import { useEffect, useMemo, useState } from "react";
import type { NotificationRow, RoomRow, UserRole, ZoneRow } from "@/types/database";
import {
  markNotificationRead,
  broadcastNotification,
  DashboardActionError,
  type BroadcastRoleFilter,
  type BroadcastScope,
} from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { createClient } from "@/lib/supabase/client";

type View = "all" | "by-status";

/**
 * Who each role may notify (server-enforced in broadcast_notification):
 *   Super Admin  -> Campus Admin / SPOC / Zone Manager / Team Lead / Member (any campus)
 *   Campus Admin -> SPOC / Zone Manager / Team Lead / Member (own campus)
 *   Zone Manager -> SPOC in their zone + Team Leads / Members of their zone
 *   SPOC         -> Team Leads / Members in their room(s) only
 *   Team Lead / Member -> receive only, no compose form.
 */
const SENDER_CONFIG: Partial<
  Record<UserRole, { roles: BroadcastRoleFilter[]; scopes: BroadcastScope[] }>
> = {
  "Super Admin": {
    roles: ["", "Campus Admin", "SPOC", "Zone Manager", "Team Lead", "Member"],
    scopes: ["all", "zone", "venue"],
  },
  "Campus Admin": {
    roles: ["", "SPOC", "Zone Manager", "Team Lead", "Member"],
    scopes: ["all", "zone", "venue"],
  },
  "Zone Manager": { roles: ["", "SPOC", "Team Lead", "Member"], scopes: ["all", "zone", "venue"] },
  SPOC: { roles: ["", "Team Lead", "Member"], scopes: ["venue"] },
};

const ROLE_LABEL: Record<BroadcastRoleFilter, string> = {
  "": "Anyone",
  "Campus Admin": "Campus Admins",
  SPOC: "SPOCs",
  "Zone Manager": "Zone Managers",
  "Team Lead": "Team Leads",
  Member: "Members",
};

export function AdminNotificationsSection({
  profileId,
  role,
  notifications,
  rooms,
  zones,
}: {
  profileId: string;
  role: UserRole;
  notifications: NotificationRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
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

  const config = SENDER_CONFIG[role];
  // A SPOC only ever sends to their own venues.
  const composeRooms = useMemo(
    () => (role === "SPOC" ? rooms.filter((r) => r.spoc_profile_id === profileId) : rooms),
    [role, rooms, profileId],
  );

  const [roleFilter, setRoleFilter] = useState<BroadcastRoleFilter>("");
  const [sendScope, setSendScope] = useState<BroadcastScope>(config?.scopes[0] ?? "all");
  const [scopeValue, setScopeValue] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const scopeLabel = (s: BroadcastScope) =>
    s === "zone" ? "By Zone" : s === "venue" ? "By Venue" : role === "SPOC" ? "All my venues" : role === "Zone Manager" ? "My whole zone" : "Everyone";

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if ((sendScope === "zone" || sendScope === "venue") && !scopeValue) {
      setSendError(`Pick a ${sendScope === "zone" ? "zone" : "venue"} to notify.`);
      return;
    }
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const count = await broadcastNotification(
        title.trim(),
        message.trim(),
        sendScope,
        sendScope === "all" ? "" : scopeValue,
        roleFilter,
      );
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
  const chip = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 font-heading text-xs transition-colors ${
      active ? "border-gold bg-gold/10 text-gold" : "border-border text-ink-muted hover:border-gold hover:text-gold"
    }`;

  return (
    <div className="flex flex-col gap-6">
      {config && (
        <form onSubmit={handleSend} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Send Notification</span>

          {/* Who */}
          <div className="flex flex-col gap-1.5">
            <span className="font-heading text-xs text-ink-muted">Send to</span>
            <div className="flex flex-wrap gap-2">
              {config.roles.map((r) => (
                <button key={r || "any"} type="button" onClick={() => setRoleFilter(r)} className={chip(roleFilter === r)}>
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Where */}
          <div className="flex flex-col gap-1.5">
            <span className="font-heading text-xs text-ink-muted">Scope</span>
            <div className="flex flex-wrap gap-2">
              {config.scopes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSendScope(s);
                    setScopeValue("");
                  }}
                  className={chip(sendScope === s)}
                >
                  {scopeLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {sendScope === "zone" && (
            <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={`w-fit ${inputClass}`}>
              <option value="">Select a zone…</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          )}
          {sendScope === "venue" && (
            <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={`w-fit ${inputClass}`}>
              <option value="">Select a venue…</option>
              {composeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

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
