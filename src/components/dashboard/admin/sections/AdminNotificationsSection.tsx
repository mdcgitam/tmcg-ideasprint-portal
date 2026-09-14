"use client";

import { useMemo, useState } from "react";
import type { CampusCode, NotificationRow, RoomRow, UserRole, ZoneRow } from "@/types/database";
import {
  markNotificationRead,
  broadcastNotification,
  DashboardActionError,
  type BroadcastRoleFilter,
  type BroadcastScope,
} from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { NotificationsInbox } from "@/components/dashboard/NotificationsInbox";
import { useTabFade } from "@/hooks/useTabFade";

type View = "send" | "inbox";

/**
 * Who each role may notify (server-enforced in broadcast_notification via
 * can_notify_target). Two pickers: "Who" (a role, or all) and "Where"
 * (everyone in reach / one zone / one venue).
 *   Super Admin  -> Campus Admin / SPOC / Zone Manager / Team Lead / Member (any campus)
 *   Campus Admin -> SPOC / Zone Manager / Team Lead / Member (own campus)
 *   Zone Manager -> SPOC + Team Leads / Members of their zone
 *   SPOC         -> Team Leads / Members in their room(s)
 *   Team Lead / Member -> receive only, no compose box.
 *
 * Send and Inbox are separate tabs — Inbox reuses the same NotificationsInbox
 * component the team dashboard uses, so every role sees an identical
 * viewing experience (each still scoped to only their own notifications).
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
  const roleOptions = SENDER_ROLES[role];
  const [view, setView] = useState<View>(roleOptions ? "send" : "inbox");
  const fadeRef = useTabFade(view);

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

  const inputClass =
    "rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold";

  return (
    <div className="flex flex-col gap-6">
      {roleOptions && (
        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            { value: "send", label: "Send" },
            { value: "inbox", label: "Inbox" },
          ]}
        />
      )}

      <div ref={fadeRef}>
        {view === "send" && roleOptions ? (
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
        ) : (
          <NotificationsInbox profileId={profileId} notifications={notifications} onMarkRead={markNotificationRead} />
        )}
      </div>
    </div>
  );
}
