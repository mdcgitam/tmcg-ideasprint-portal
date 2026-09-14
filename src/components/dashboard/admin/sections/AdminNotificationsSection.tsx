"use client";

import { useMemo, useState } from "react";
import type {
  CampusCode,
  NotificationBroadcastRow,
  NotificationRow,
  ProfileRow,
  RoomRow,
  TeamRow,
  UserRole,
  ZoneRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import {
  markNotificationRead,
  broadcastNotification,
  DashboardActionError,
  type BroadcastRoleFilter,
  type BroadcastScope,
} from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { NotificationsInbox, MessageModal } from "@/components/dashboard/NotificationsInbox";
import { useTabFade } from "@/hooks/useTabFade";

type View = "send" | "inbox" | "sent";

/**
 * Who each role may notify (server-enforced in broadcast_notification via
 * can_notify_target). Three pickers: "Who" (a role, or all), "Where"
 * (everyone in reach / one campus / one zone / one venue), and an optional
 * "Person" narrowing to one specific individual — for cases role+scope
 * alone can't isolate one person (more than one Campus Admin at a campus, a
 * specific Super Admin, one named Team Lead/Member rather than "everyone at
 * this venue"). Leaving Person on "Everyone matching" sends to the whole
 * role+scope match, same as before this existed.
 *   Super Admin  -> Campus Admin / SPOC / Zone Manager / Team Lead / Member (any campus)
 *   Campus Admin -> SPOC / Zone Manager / Team Lead / Member (own campus)
 *   Zone Manager -> SPOC + Team Leads / Members of their zone
 *   SPOC         -> Team Leads / Members in their room(s)
 *   Team Lead / Member -> receive only, no compose box.
 *
 * Send, Inbox and Sent are separate tabs — Inbox reuses the same
 * NotificationsInbox component the team dashboard uses, so every role sees
 * an identical viewing experience (each still scoped to only their own
 * notifications). Sent lists this sender's own past broadcasts.
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

const CAMPUS_CODES: CampusCode[] = ["VSP", "HYD", "BLR"];

/** Which "Where" scopes make sense for the selected "Who". Campus is offered for every role now — broadcast_notification already supports scope='campus' regardless of role_filter. */
function whereKinds(who: BroadcastRoleFilter): Array<"campus" | "zone" | "venue"> {
  if (who === "Campus Admin") return ["campus"];
  if (who === "Zone Manager") return ["campus", "zone"];
  return ["campus", "zone", "venue"];
}

interface PersonOption {
  id: string;
  name: string;
  roleLabel: string;
}

/** People who currently match a Who+Where combination — the candidate list for the optional "Person" narrowing. Mirrors broadcast_notification's own matching logic, but client-side over already-reach-scoped data. */
function matchingPeople(
  roleFilter: BroadcastRoleFilter,
  where: string,
  ctx: {
    staffAccounts: ProfileRow[];
    rooms: RoomRow[];
    zones: ZoneRow[];
    teams: TeamRow[];
    membersByTeam: Record<string, TeamMemberProfile[]>;
  },
): PersonOption[] {
  if (!roleFilter) return [];
  const [kind, value] = where.split(":");
  const roles = roleFilter.split(",");
  const people: PersonOption[] = [];

  function roomMatchesWhere(room: RoomRow | null): boolean {
    if (kind === "all") return true;
    if (!room) return false;
    if (kind === "campus") return room.campus === value;
    if (kind === "zone") return room.zone_id === value;
    return room.id === value; // venue
  }

  if (roles.includes("Campus Admin")) {
    for (const p of ctx.staffAccounts) {
      if (p.role !== "Campus Admin") continue;
      if (kind === "campus" && p.campus !== value) continue;
      if (kind === "zone" || kind === "venue") continue; // Campus Admin who never offers zone/venue Where
      people.push({ id: p.id, name: p.name, roleLabel: "Campus Admin" });
    }
  }
  if (roles.includes("Zone Manager")) {
    for (const z of ctx.zones) {
      if (!z.zone_manager_profile_id) continue;
      if (kind === "campus" && z.campus !== value) continue;
      if (kind === "zone" && z.id !== value) continue;
      if (kind === "venue") continue; // Zone Manager who never offers venue Where
      const p = ctx.staffAccounts.find((s) => s.id === z.zone_manager_profile_id);
      if (p) people.push({ id: p.id, name: p.name, roleLabel: "Zone Manager" });
    }
  }
  if (roles.includes("SPOC")) {
    for (const r of ctx.rooms) {
      if (!r.spoc_profile_id || !roomMatchesWhere(r)) continue;
      const p = ctx.staffAccounts.find((s) => s.id === r.spoc_profile_id);
      if (p) people.push({ id: p.id, name: p.name, roleLabel: "SPOC" });
    }
  }
  if (roles.includes("Team Lead") || roles.includes("Member")) {
    for (const team of ctx.teams) {
      const room = ctx.rooms.find((r) => r.id === team.room_id) ?? null;
      if (!roomMatchesWhere(room)) continue;
      for (const m of ctx.membersByTeam[team.id] ?? []) {
        if (m.is_lead && !roles.includes("Team Lead")) continue;
        if (!m.is_lead && !roles.includes("Member")) continue;
        people.push({ id: m.id, name: m.name, roleLabel: m.is_lead ? "Team Lead" : "Member" });
      }
    }
  }

  const seen = new Set<string>();
  return people.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).sort((a, b) => a.name.localeCompare(b.name));
}

export function AdminNotificationsSection({
  profileId,
  role,
  notifications,
  sentBroadcasts,
  rooms,
  zones,
  staffAccounts,
  teams,
  membersByTeam,
}: {
  profileId: string;
  role: UserRole;
  notifications: NotificationRow[];
  sentBroadcasts: NotificationBroadcastRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
}) {
  const roleOptions = SENDER_ROLES[role];
  const [view, setView] = useState<View>(roleOptions ? "send" : "inbox");
  const fadeRef = useTabFade(view);
  const [localSent, setLocalSent] = useState(sentBroadcasts);
  const [openSentId, setOpenSentId] = useState<string | null>(null);

  /** id -> display name, across staff and every team member — used to show "To: <name>" for a person-targeted send. */
  const personName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of staffAccounts) map.set(p.id, p.name);
    for (const members of Object.values(membersByTeam)) {
      for (const m of members) map.set(m.id, m.name);
    }
    return map;
  }, [staffAccounts, membersByTeam]);

  /** "To: <name>" for a person-targeted send, else "<who label> · <where label>". */
  function audienceLabel(b: NotificationBroadcastRow): string {
    if (b.target_profile_id) {
      return `To: ${personName.get(b.target_profile_id) ?? "One person"}`;
    }
    const who = ROLE_LABEL[(b.role_filter || "") as BroadcastRoleFilter] ?? b.role_filter;
    const where =
      b.scope === "all"
        ? "Everyone in reach"
        : b.scope === "campus"
          ? (CAMPUS_NAME[b.scope_value as CampusCode] ?? b.scope_value ?? "Campus")
          : b.scope === "zone"
            ? `Zone · ${zones.find((z) => z.id === b.scope_value)?.name ?? "Unknown"}`
            : `Venue · ${rooms.find((r) => r.id === b.scope_value)?.name ?? "Unknown"}`;
    return `${who} · ${where}`;
  }

  // SPOC only ever sends into their own venues; others get the list as scoped by fetchAdminDashboardData.
  const whereRooms = useMemo(
    () => (role === "SPOC" ? rooms.filter((r) => r.spoc_profile_id === profileId) : rooms),
    [role, rooms, profileId],
  );

  const [roleFilter, setRoleFilter] = useState<BroadcastRoleFilter>("");
  // "where" is a single string: "all" | `campus:<code>` | `zone:<id>` | `venue:<id>`
  const [where, setWhere] = useState("all");
  const [targetProfileId, setTargetProfileId] = useState("");
  const kinds = whereKinds(roleFilter);
  // A SPOC only ever has one venue, so "My venue" is the whole story — no
  // venue list. A Zone Manager with a single zone likewise needs no zone
  // list beyond "My whole zone".
  const selfAllIsOneZone = role === "Zone Manager" && zones.length === 1;

  // Purely a display narrowing for the Zone/Venue option lists below — not
  // part of `where` itself, and doesn't remove any capability (the explicit
  // "campus:<code>" options above are unaffected). Only worth showing when
  // there's more than one campus's worth of zones/venues to narrow, which
  // in practice means only the Super Admin's "All" module.
  const [listCampusFilter, setListCampusFilter] = useState<CampusCode | "">("");
  const spansMultipleCampuses = new Set([...zones.map((z) => z.campus), ...whereRooms.map((r) => r.campus)]).size > 1;
  const displayZones = listCampusFilter ? zones.filter((z) => z.campus === listCampusFilter) : zones;
  const displayRooms = listCampusFilter ? whereRooms.filter((r) => r.campus === listCampusFilter) : whereRooms;

  const people = useMemo(
    () => matchingPeople(roleFilter, where, { staffAccounts, rooms, zones, teams, membersByTeam }),
    [roleFilter, where, staffAccounts, rooms, zones, teams, membersByTeam],
  );

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
      const sentTitle = title.trim();
      const sentMessage = message.trim();
      const target = targetProfileId || null;
      const count = await broadcastNotification(sentTitle, sentMessage, scope, id ?? "", roleFilter, target);
      setSendSuccess(`Sent to ${count} ${count === 1 ? "person" : "people"}.`);
      setLocalSent((prev) => [
        {
          id: crypto.randomUUID(),
          sender_profile_id: profileId,
          title: sentTitle,
          message: sentMessage,
          scope,
          scope_value: id ?? null,
          role_filter: roleFilter,
          recipient_count: count,
          target_profile_id: target,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
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
            { value: "sent", label: "Sent" },
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
                    setTargetProfileId("");
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

              {kinds.length > 1 && role !== "SPOC" && spansMultipleCampuses && (
                <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
                  Narrow list to campus
                  <select
                    value={listCampusFilter}
                    onChange={(e) => setListCampusFilter(e.target.value as CampusCode | "")}
                    className={inputClass}
                  >
                    <option value="">All campuses</option>
                    {CAMPUS_CODES.map((c) => (
                      <option key={c} value={c}>
                        {CAMPUS_NAME[c]} ({c})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
                Where
                <select
                  value={where}
                  onChange={(e) => {
                    setWhere(e.target.value);
                    setTargetProfileId("");
                  }}
                  className={inputClass}
                >
                  <option value="all">
                    {role === "SPOC" ? "My venue" : role === "Zone Manager" ? "My whole zone" : "Everyone in reach"}
                  </option>
                  {kinds.includes("campus") &&
                    role !== "SPOC" &&
                    CAMPUS_CODES.map((c) => (
                      <option key={c} value={`campus:${c}`}>
                        {CAMPUS_NAME[c]} — whole campus
                      </option>
                    ))}
                  {kinds.includes("zone") &&
                    role !== "SPOC" &&
                    !selfAllIsOneZone &&
                    displayZones.map((z) => (
                      <option key={z.id} value={`zone:${z.id}`}>
                        Zone · {z.name}
                      </option>
                    ))}
                  {kinds.includes("venue") &&
                    role !== "SPOC" &&
                    displayRooms.map((r) => (
                      <option key={r.id} value={`venue:${r.id}`}>
                        Venue · {r.name}
                      </option>
                    ))}
                </select>
              </label>

              {roleFilter && people.length > 0 && (
                <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
                  Person <span className="normal-case text-ink-faint">(optional)</span>
                  <select
                    value={targetProfileId}
                    onChange={(e) => setTargetProfileId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Everyone matching above ({people.length})</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.roleLabel})
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
        ) : view === "sent" ? (
          <SentBroadcastsList sent={localSent} audienceLabel={audienceLabel} openId={openSentId} onOpen={setOpenSentId} />
        ) : (
          <NotificationsInbox profileId={profileId} notifications={notifications} onMarkRead={markNotificationRead} />
        )}
      </div>
    </div>
  );
}

const SENT_TO_OPTIONS: BroadcastRoleFilter[] = ["", "Campus Admin", "SPOC", "Zone Manager", "Team Lead", "Member", "Team Lead,Member"];

function SentBroadcastsList({
  sent,
  audienceLabel,
  openId,
  onOpen,
}: {
  sent: NotificationBroadcastRow[];
  audienceLabel: (b: NotificationBroadcastRow) => string;
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [toFilter, setToFilter] = useState<BroadcastRoleFilter | "any">("any");
  const open = openId ? (sent.find((b) => b.id === openId) ?? null) : null;
  const toOptionsPresent = useMemo(
    () => SENT_TO_OPTIONS.filter((r) => sent.some((b) => b.role_filter === r)),
    [sent],
  );
  const visible = toFilter === "any" ? sent : sent.filter((b) => b.role_filter === toFilter);

  if (sent.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">You haven&apos;t sent any notifications yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {toOptionsPresent.length > 1 && (
        <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
          To
          <select
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value as BroadcastRoleFilter | "any")}
            className="w-fit rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
          >
            <option value="any">Everyone I&apos;ve sent to</option>
            {toOptionsPresent.map((r) => (
              <option key={r || "all"} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No sent notifications match this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onOpen(b.id)}
              className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-sm font-semibold text-ink">{b.title}</p>
                <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-ink-muted">
                  {b.recipient_count} {b.recipient_count === 1 ? "recipient" : "recipients"}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 font-heading text-sm text-ink-muted">{b.message}</p>
              <p className="mt-2 font-mono text-xs text-ink-faint">
                {audienceLabel(b)} · {new Date(b.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </button>
          ))}
        </div>
      )}

      {open && <MessageModal notification={open} onClose={() => onOpen(null)} />}
    </div>
  );
}
