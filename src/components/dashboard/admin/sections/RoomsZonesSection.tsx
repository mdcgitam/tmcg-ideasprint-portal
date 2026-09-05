"use client";

import { useState } from "react";
import type { ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import {
  assignRoomToZone,
  assignSpocToRoom,
  assignTeamToRoom,
  assignZoneManager,
  createRoom,
  createZone,
  DashboardActionError,
} from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "manage" | "by-zone";

const UNASSIGN = "__unassign__";

/**
 * Rooms module (ideasprint_changes.pdf "Room assignment" doubt + item 11):
 * Super Admin adds rooms, groups them into zones with a zone manager, and
 * assigns a SPOC to a room only — never directly to a team or person. Adding
 * a team to a room immediately inherits that room's current SPOC (server-
 * side, via assign_team_to_room / the rooms_spoc_cascade trigger), which is
 * what TeamsListSection then reads back as "Assigned SPOC". A team's own
 * dashboard (ProfileSection) reads the same room_id/spoc_profile_id back —
 * a server component, so the very next load shows the assignment.
 *
 * Team→room assignment has exactly one control: the checkbox + bulk-assign
 * bar below the table. It replaced an earlier version with three separate
 * ways to do the same thing (a multi-select in the create-room form, a
 * per-row select, and this bar) — that was the actual source of confusion,
 * not the SPOC/zone fields, which keep their normal "set at creation, edit
 * later" pattern.
 */
export function RoomsZonesSection({
  rooms,
  zones,
  teams,
  membersByTeam,
  spocs,
  staffAccounts,
}: {
  rooms: RoomRow[];
  zones: ZoneRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  spocs: ProfileRow[];
  staffAccounts: ProfileRow[];
}) {
  const [localRooms, setLocalRooms] = useState(rooms);
  const [localZones, setLocalZones] = useState(zones);
  const [localTeams, setLocalTeams] = useState(teams);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [zoneName, setZoneName] = useState("");
  const [creatingZone, setCreatingZone] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomZoneId, setRoomZoneId] = useState("");
  const [roomSpocId, setRoomSpocId] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [view, setView] = useState<View>("manage");
  const fadeRef = useTabFade(view);

  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [bulkRoomId, setBulkRoomId] = useState("");
  const [bulkAssignBusy, setBulkAssignBusy] = useState(false);

  const staffById = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomById = (id: string | null) => localRooms.find((r) => r.id === id) ?? null;
  const zoneById = (id: string | null) => localZones.find((z) => z.id === id) ?? null;
  const campusOf = (team: TeamRow) => (membersByTeam[team.id] ?? []).find((m) => m.is_lead)?.campus ?? "—";

  function toggleTeamSelected(teamId: string) {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  async function handleBulkAssignRoom() {
    if (!bulkRoomId || selectedTeamIds.size === 0) return;
    setBulkAssignBusy(true);
    setError(null);
    try {
      const targetRoomId = bulkRoomId === UNASSIGN ? null : bulkRoomId;
      const spoc = targetRoomId ? (roomById(targetRoomId)?.spoc_profile_id ?? null) : null;
      const teamIds = Array.from(selectedTeamIds);
      await Promise.all(teamIds.map((teamId) => assignTeamToRoom(teamId, targetRoomId)));
      setLocalTeams((prev) =>
        prev.map((t) => (selectedTeamIds.has(t.id) ? { ...t, room_id: targetRoomId, spoc_profile_id: spoc } : t)),
      );
      setSelectedTeamIds(new Set());
      setBulkRoomId("");
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBulkAssignBusy(false);
    }
  }

  async function handleCreateZone(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneName.trim()) return;
    setCreatingZone(true);
    setError(null);
    try {
      const id = await createZone(zoneName.trim(), null);
      setLocalZones((prev) => [
        ...prev,
        { id, name: zoneName.trim(), zone_manager_profile_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]);
      setZoneName("");
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setCreatingZone(false);
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) return;
    setCreatingRoom(true);
    setError(null);
    try {
      const zoneId = roomZoneId || null;
      const spocId = roomSpocId || null;
      const id = await createRoom(roomName.trim(), zoneId);

      if (spocId) await assignSpocToRoom(id, spocId);

      setLocalRooms((prev) => [
        ...prev,
        {
          id,
          name: roomName.trim(),
          zone_id: zoneId,
          spoc_profile_id: spocId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      setRoomName("");
      setRoomZoneId("");
      setRoomSpocId("");
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleAssignZoneManager(zoneId: string, managerProfileId: string) {
    const key = `zone-manager:${zoneId}`;
    setBusy(key);
    setError(null);
    try {
      const value = managerProfileId || null;
      await assignZoneManager(zoneId, value);
      setLocalZones((prev) => prev.map((z) => (z.id === zoneId ? { ...z, zone_manager_profile_id: value } : z)));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAssignRoomZone(roomId: string, zoneId: string) {
    const key = `room-zone:${roomId}`;
    setBusy(key);
    setError(null);
    try {
      const value = zoneId || null;
      await assignRoomToZone(roomId, value);
      setLocalRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, zone_id: value } : r)));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function handleAssignRoomSpoc(roomId: string, spocProfileId: string) {
    const key = `room-spoc:${roomId}`;
    setBusy(key);
    setError(null);
    try {
      const value = spocProfileId || null;
      await assignSpocToRoom(roomId, value);
      setLocalRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, spoc_profile_id: value } : r)));
      // The server cascades this room's SPOC onto every team already in it —
      // mirror that locally so the "Add Teams" table below reflects it immediately.
      setLocalTeams((prev) => prev.map((t) => (t.room_id === roomId ? { ...t, spoc_profile_id: value } : t)));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "manage", label: "Manage" },
          { value: "by-zone", label: "View by Zone" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "manage" ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Add Zone</span>
          <form onSubmit={handleCreateZone} className="mt-3 flex gap-3">
            <input
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g. Zone A"
              className="flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={creatingZone}
              className="rounded-full bg-gold px-5 py-2 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {creatingZone ? "Adding…" : "Add"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-2">
            {localZones.length === 0 ? (
              <p className="font-heading text-xs text-ink-muted">No zones yet.</p>
            ) : (
              localZones.map((zone) => (
                <div key={zone.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5">
                  <span className="font-heading text-sm text-ink">{zone.name}</span>
                  <select
                    value={zone.zone_manager_profile_id ?? ""}
                    disabled={busy === `zone-manager:${zone.id}`}
                    onChange={(e) => handleAssignZoneManager(zone.id, e.target.value)}
                    className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold"
                  >
                    <option value="">No zone manager</option>
                    {staffAccounts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Add Room</span>
          <form onSubmit={handleCreateRoom} className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Room 101"
                className="flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
              />
              <select
                value={roomZoneId}
                onChange={(e) => setRoomZoneId(e.target.value)}
                className="rounded-lg border border-border bg-void px-3 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
              >
                <option value="">No zone</option>
                {localZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <select
                value={roomSpocId}
                onChange={(e) => setRoomSpocId(e.target.value)}
                className="rounded-lg border border-border bg-void px-3 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
              >
                <option value="">No SPOC</option>
                {spocs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="font-heading text-xs text-ink-faint">
              Assign teams to this room afterwards, below in &ldquo;Add Teams Into Rooms&rdquo;.
            </p>

            <button
              type="submit"
              disabled={creatingRoom}
              className="w-fit rounded-full bg-gold px-5 py-2 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {creatingRoom ? "Adding…" : "Add Room"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-2">
            {localRooms.length === 0 ? (
              <p className="font-heading text-xs text-ink-muted">No rooms yet.</p>
            ) : (
              localRooms.map((room) => (
                <div key={room.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5">
                  <span className="font-heading text-sm text-ink">{room.name}</span>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={room.zone_id ?? ""}
                      disabled={busy === `room-zone:${room.id}`}
                      onChange={(e) => handleAssignRoomZone(room.id, e.target.value)}
                      className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold"
                    >
                      <option value="">No zone</option>
                      {localZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={room.spoc_profile_id ?? ""}
                      disabled={busy === `room-spoc:${room.id}` || spocs.length === 0}
                      onChange={(e) => handleAssignRoomSpoc(room.id, e.target.value)}
                      className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold"
                    >
                      <option value="">No SPOC</option>
                      {spocs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

            <div className="rounded-xl border border-border bg-surface p-6">
              <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Add Teams Into Rooms</span>
              <p className="mt-2 font-heading text-xs text-ink-muted">
                Check one or more teams below, pick a room, and assign — this is the only place team-to-room
                assignment happens. A team immediately inherits that room&rsquo;s SPOC; SPOCs are never assigned to a
                team directly.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="font-heading text-xs text-ink-muted">Assign selected teams to:</span>
                <select
                  value={bulkRoomId}
                  onChange={(e) => setBulkRoomId(e.target.value)}
                  className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold"
                >
                  <option value="">Choose a room…</option>
                  <option value={UNASSIGN}>No room (unassign)</option>
                  {localRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={bulkAssignBusy || !bulkRoomId || selectedTeamIds.size === 0}
                  onClick={handleBulkAssignRoom}
                  className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                >
                  {bulkAssignBusy ? "Working…" : bulkRoomId === UNASSIGN ? "Unassign Selected" : "Assign Selected"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTeamIds(new Set())}
                  className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
                >
                  Clear
                </button>
                <span className="font-heading text-xs text-ink-muted">Selected: {selectedTeamIds.size} team(s)</span>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left font-heading text-sm">
                  <thead>
                    <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Campus</th>
                      <th className="px-4 py-3">Team Name</th>
                      <th className="px-4 py-3">Venue</th>
                      <th className="px-4 py-3">SPOC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localTeams.map((team) => {
                      const room = roomById(team.room_id);
                      const zone = room ? zoneById(room.zone_id) : null;
                      const venue = room ? (zone ? `${room.name} (${zone.name})` : room.name) : "Unassigned";
                      return (
                        <tr key={team.id} className="border-b border-border bg-surface last:border-0">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedTeamIds.has(team.id)}
                              onChange={() => toggleTeamSelected(team.id)}
                            />
                          </td>
                          <td className="px-4 py-3 text-ink-muted">{campusOf(team)}</td>
                          <td className="px-4 py-3 text-ink">
                            {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                          </td>
                          <td className="px-4 py-3 text-ink-muted">{venue}</td>
                          <td className="px-4 py-3 text-ink-muted">{staffById(team.spoc_profile_id) ?? "Unassigned"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[...localZones, null].map((zone) => {
              const zoneRooms = localRooms.filter((r) => (zone ? r.zone_id === zone.id : !r.zone_id));
              if (zone === null && zoneRooms.length === 0 && localTeams.every((t) => t.room_id)) return null;
              return (
                <div key={zone?.id ?? "unassigned"} className="rounded-xl border border-border bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-sm text-ink">{zone?.name ?? "Unassigned"}</span>
                    {zone && (
                      <span className="font-mono text-[10px] text-ink-faint uppercase">
                        Manager: {staffById(zone.zone_manager_profile_id) ?? "Unassigned"}
                      </span>
                    )}
                  </div>
                  {zoneRooms.length === 0 ? (
                    <p className="mt-2 font-heading text-xs text-ink-muted">No rooms in this zone.</p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2">
                      {zoneRooms.map((room) => {
                        const roomTeams = localTeams.filter((t) => t.room_id === room.id);
                        return (
                          <div key={room.id} className="rounded-lg border border-border px-4 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-heading text-sm text-ink">{room.name}</span>
                              <span className="font-mono text-[10px] text-ink-faint uppercase">
                                SPOC: {staffById(room.spoc_profile_id) ?? "Unassigned"}
                              </span>
                            </div>
                            <p className="mt-1 font-heading text-xs text-ink-muted">
                              {roomTeams.length === 0
                                ? "No teams assigned."
                                : roomTeams.map((t) => t.team_name).join(", ")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {zone === null && (
                    <div className="mt-3 flex flex-col gap-1">
                      {localTeams
                        .filter((t) => !t.room_id)
                        .map((t) => (
                          <p key={t.id} className="font-heading text-xs text-ink-muted">
                            {t.team_name} — no room assigned
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
