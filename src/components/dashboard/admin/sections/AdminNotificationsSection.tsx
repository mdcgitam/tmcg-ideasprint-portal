"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampusCode, NotificationRow, RoomRow, UserRole, ZoneRow } from "@/types/database";
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
 * Who each role may notify (server-enforced in broadcast_notification via
 * can_notify_target). Two pickers: "Who" (a role, or all) and "Where"
 * (everyone in reach / one zone / one venue).
 *   Super Admin  -> Campus Admin / SPOC / Zone Manager / Team Lead / Member (any campus)
 *   Campus Admin -> SPOC / Zone Manager / Team Lead / Member (own campus)
 *   Zone Manager -> SPOC + Team Leads / Members of their zone
 *   SPOC         -> Team Leads / Members in their room(s)
 *   Team Lead / Member -> receive only, no compose box.
 */
const SENDER_ROLES: Partial<Record<UserRole, BroadcastRoleFilter[]>> = {
  "Super Admin": ["", "Campus Admin", "SPOC", "Zone Manager", "Team Lead", "Member", "Team Lead,Member"],
  "Campus Admin": ["", "SPOC", "Zone Manager", "Team Lead", "Member", "Team Lead,Member"],
  "Zone Manager": ["", "SPOC", "Team Lead", "Member", "Team Lead,Member"],
  SPOC: ["", "Team Lead", "Member", "Team Lead,Member"],
};

const ROLE_LABEL: Record<BroadcastRoleFilter, string> = {
  "": "Everyone (all roles)",
  "Campus Admin": "Campus Admins",
  SPOC: "SPOCs",
  "Zone Manager": "Zone Managers",
  "Team Lead": "Team Leads",
  Member: "Members",
  "Team Lead,Member": "Team Leads + Members",
};

const CAMPUS_NAME: Record<CampusCode, string> = {
  VSP: "Visakhapatnam",
  HYD: "Hyderabad",
  BLR: "Bangalore",
};

/** Which "Where" scopes make sense for the selected "Who". */
function whereKinds(who: BroadcastRoleFilter): Array<"campus" | "zone" | "venue"> {
  if (who === "Campus Admin") return ["campus"];
  if (who === "Zone Manager") return ["zone"];
  return ["zone", "venue"];
}

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

  const roleOptions = SENDER_ROLES[role];
  // SPOC only ever sends into their own venues; others get the list as scoped by fetchAdminDashboardData.
  const whereRooms = useMemo(
    () => (role === "SPOC" ? rooms.filter((r) => r.spoc_profile_id === profileId) : rooms),
    [role, rooms, profileId],
  );

  const [roleFilter, setRoleFilter] = useState<BroadcastRoleFilter>("");
  // "where" is a single string: "all" | `campus:<code>` | `zone:<id>` | `venue:<id>`
  const [where, setWhere] = useState("all");
  const kinds = whereKinds(roleFilter);
  const campusCodes: CampusCode[] = ["VSP", "HYD", "BLR"];
  // A SPOC only ever has one venue, so "My venue" is the whole story — no
  // venue list. A Zone Manager with a single zone likewise needs no zone
  // list beyond "My whole zone".
  const selfAllIsOneZone = role === "Zone Manager" && zones.length === 1;
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const [kind, id] = where.split(":");
    const scope: BroadcastScope =
      kind === "zone" || kind === "venue" || kind === "campus" ? kind : "all";
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const count = await broadcastNotification(title.trim(), message.trim(), scope, id ?? "", roleFilter);
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

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
              Who
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as BroadcastRoleFilter);
                  setWhere("all");
                }}
                className={inputClass}
              >
                {roleOptions.map((r) => (
                  <option key={r || "all"} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
              Where
              <select value={where} onChange={(e) => setWhere(e.target.value)} className={inputClass}>
                <option value="all">
                  {role === "SPOC" ? "My venue" : role === "Zone Manager" ? "My whole zone" : "Everyone in reach"}
                </option>
                {kinds.includes("campus") &&
                  campusCodes.map((c) => (
                    <option key={c} value={`campus:${c}`}>
                      {CAMPUS_NAME[c]} ({c})
                    </option>
                  ))}
                {kinds.includes("zone") &&
                  role !== "SPOC" &&
                  !selfAllIsOneZone &&
                  zones.map((z) => (
                    <option key={z.id} value={`zone:${z.id}`}>
                      Zone · {z.name}
                    </option>
                  ))}
                {kinds.includes("venue") &&
                  role !== "SPOC" &&
                  whereRooms.map((r) => (
                    <option key={r.id} value={`venue:${r.id}`}>
                      Venue · {r.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

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
