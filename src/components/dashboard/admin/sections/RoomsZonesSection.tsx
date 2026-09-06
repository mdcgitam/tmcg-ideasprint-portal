"use client";

import { Fragment, useState } from "react";
import type { CampusCode, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import {
  assignRoomToZone,
  assignSpocToRoom,
  assignTeamToRoom,
  assignZoneManager,
  createRoom,
  createZone,
  deleteRoom,
  deleteZone,
  updateRoomName,
  updateZoneName,
  DashboardActionError,
} from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "create" | "assign";

const UNASSIGN = "__unassign__";

/**
 * Zones and Venues module. Two tabs:
 *  - Create: make Zones and Venues (a Venue is created with its Zone and its
 *    SPOC), with a table below both boxes showing Campus / Zone / the Venues
 *    grouped under that Zone / the SPOC on each Venue.
 *  - Assign: re-assign a Venue's Zone or SPOC, set Zone managers, and put
 *    teams into Venues (a team inherits its Venue's SPOC server-side — SPOCs
 *    are never assigned to a team directly).
 */
export function RoomsZonesSection({
  campus,
  rooms,
  zones,
  teams,
  membersByTeam,
  spocs,
  staffAccounts,
}: {
  campus: CampusCode | null;
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
  const [view, setView] = useState<View>("create");
  const fadeRef = useTabFade(view);

  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [bulkRoomId, setBulkRoomId] = useState("");
  const [bulkAssignBusy, setBulkAssignBusy] = useState(false);

  // Inline edit state for the Create-tab table
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [roomDraft, setRoomDraft] = useState({ name: "", zoneId: "", spocId: "" });
  const [editZoneId, setEditZoneId] = useState<string | null>(null);
  const [zoneDraft, setZoneDraft] = useState("");

  const staffById = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomById = (id: string | null) => localRooms.find((r) => r.id === id) ?? null;
  const zoneById = (id: string | null) => localZones.find((z) => z.id === id) ?? null;
  const campusOf = (team: TeamRow) => (membersByTeam[team.id] ?? []).find((m) => m.is_lead)?.campus ?? team.campus ?? "—";

  /** Zones (plus an "Unassigned" bucket) with the venues that sit in each. */
  const zoneGroups: Array<{ zone: ZoneRow | null; venues: RoomRow[] }> = [
    ...localZones.map((zone) => ({ zone, venues: localRooms.filter((r) => r.zone_id === zone.id) })),
    { zone: null, venues: localRooms.filter((r) => !r.zone_id) },
  ].filter((g) => g.zone !== null || g.venues.length > 0);

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
      const id = await createZone(zoneName.trim(), null, campus);
      setLocalZones((prev) => [
        ...prev,
        { id, name: zoneName.trim(), campus: campus ?? "VSP", zone_manager_profile_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
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
      const id = await createRoom(roomName.trim(), zoneId, campus);

      if (spocId) await assignSpocToRoom(id, spocId);

      setLocalRooms((prev) => [
        ...prev,
        {
          id,
          name: roomName.trim(),
          campus: campus ?? "VSP",
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
    setBusy(`zone-manager:${zoneId}`);
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

  function startEditRoom(room: RoomRow) {
    setEditZoneId(null);
    setEditRoomId(room.id);
    setRoomDraft({ name: room.name, zoneId: room.zone_id ?? "", spocId: room.spoc_profile_id ?? "" });
  }

  async function handleSaveRoom(room: RoomRow) {
    const name = roomDraft.name.trim();
    if (!name) return;
    const zoneId = roomDraft.zoneId || null;
    const spocId = roomDraft.spocId || null;
    setBusy(`edit-room:${room.id}`);
    setError(null);
    try {
      if (name !== room.name) await updateRoomName(room.id, name);
      if (zoneId !== room.zone_id) await assignRoomToZone(room.id, zoneId);
      if (spocId !== room.spoc_profile_id) await assignSpocToRoom(room.id, spocId);
      setLocalRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, name, zone_id: zoneId, spoc_profile_id: spocId } : r)));
      if (spocId !== room.spoc_profile_id) {
        setLocalTeams((prev) => prev.map((t) => (t.room_id === room.id ? { ...t, spoc_profile_id: spocId } : t)));
      }
      setEditRoomId(null);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteRoom(room: RoomRow) {
    if (!window.confirm(`Delete venue "${room.name}"? Teams in it are pulled out and lose its SPOC.`)) return;
    setBusy(`del-room:${room.id}`);
    setError(null);
    try {
      await deleteRoom(room.id);
      setLocalRooms((prev) => prev.filter((r) => r.id !== room.id));
      setLocalTeams((prev) => prev.map((t) => (t.room_id === room.id ? { ...t, room_id: null, spoc_profile_id: null } : t)));
      if (editRoomId === room.id) setEditRoomId(null);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveZone(zone: ZoneRow) {
    const name = zoneDraft.trim();
    if (!name || name === zone.name) {
      setEditZoneId(null);
      return;
    }
    setBusy(`edit-zone:${zone.id}`);
    setError(null);
    try {
      await updateZoneName(zone.id, name);
      setLocalZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, name } : z)));
      setEditZoneId(null);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteZone(zone: ZoneRow) {
    if (!window.confirm(`Delete zone "${zone.name}"? Its venues stay but become zone-less.`)) return;
    setBusy(`del-zone:${zone.id}`);
    setError(null);
    try {
      await deleteZone(zone.id);
      setLocalZones((prev) => prev.filter((z) => z.id !== zone.id));
      setLocalRooms((prev) => prev.map((r) => (r.zone_id === zone.id ? { ...r, zone_id: null } : r)));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const inputClass =
    "rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold";
  const selectClass =
    "rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold";

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "create", label: "Create" },
          { value: "assign", label: "Assign" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "create" ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Create Zone */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Create Zone</span>
                <form onSubmit={handleCreateZone} className="mt-3 flex gap-3">
                  <input
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder="e.g. Zone A"
                    className={`flex-1 ${inputClass}`}
                  />
                  <button
                    type="submit"
                    disabled={creatingZone}
                    className="rounded-full bg-gold px-5 py-2 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                  >
                    {creatingZone ? "Adding…" : "Add Zone"}
                  </button>
                </form>

                {localZones.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                    {localZones.map((z) =>
                      editZoneId === z.id ? (
                        <div key={z.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-4 py-2">
                          <input
                            value={zoneDraft}
                            onChange={(e) => setZoneDraft(e.target.value)}
                            className={`flex-1 ${inputClass} py-1 text-sm`}
                          />
                          <button type="button" onClick={() => handleSaveZone(z)} disabled={busy === `edit-zone:${z.id}`} className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-void hover:bg-gold-light disabled:opacity-60">
                            Save
                          </button>
                          <button type="button" onClick={() => setEditZoneId(null)} className="rounded-full border border-border px-3 py-1 text-xs text-ink-muted hover:bg-void">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div key={z.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2">
                          <span className="font-heading text-sm text-ink">{z.name}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={z.zone_manager_profile_id ?? ""}
                              disabled={busy === `zone-manager:${z.id}`}
                              onChange={(e) => handleAssignZoneManager(z.id, e.target.value)}
                              className={selectClass}
                              aria-label={`Zone manager for ${z.name}`}
                            >
                              <option value="">No zone manager</option>
                              {staffAccounts.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.role})
                                </option>
                              ))}
                            </select>
                            <button type="button" onClick={() => { setEditZoneId(z.id); setZoneDraft(z.name); }} className="text-xs text-gold underline">
                              Edit
                            </button>
                            <button type="button" onClick={() => handleDeleteZone(z)} disabled={busy === `del-zone:${z.id}`} className="text-xs text-danger underline disabled:opacity-60">
                              Delete
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Create Venue */}
              <div className="rounded-xl border border-border bg-surface p-6">
                <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Create Venue</span>
                <form onSubmit={handleCreateRoom} className="mt-3 flex flex-col gap-3">
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g. Room 101"
                    className={inputClass}
                  />
                  <div className="flex flex-wrap gap-3">
                    <select value={roomZoneId} onChange={(e) => setRoomZoneId(e.target.value)} className={`${selectClass} py-2 text-sm`}>
                      <option value="">No zone</option>
                      {localZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                    <select value={roomSpocId} onChange={(e) => setRoomSpocId(e.target.value)} className={`${selectClass} py-2 text-sm`}>
                      <option value="">No SPOC</option>
                      {spocs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingRoom}
                    className="w-fit rounded-full bg-gold px-5 py-2 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                  >
                    {creatingRoom ? "Adding…" : "Add Venue"}
                  </button>
                </form>
                <p className="mt-3 font-heading text-xs text-ink-faint">
                  Put teams into this Venue afterwards, in the Assign tab.
                </p>
              </div>
            </div>

            {/* One table below both boxes: Campus / Zone / Venues in that zone / SPOC per venue, each editable + deletable */}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-left font-heading text-sm">
                <thead>
                  <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                    <th className="px-4 py-3">Campus</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Venues in that Zone</th>
                    <th className="px-4 py-3">SPOC</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneGroups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center font-heading text-sm text-ink-muted">
                        No zones or venues yet.
                      </td>
                    </tr>
                  ) : (
                    zoneGroups.map(({ zone, venues }) => {
                      const rowCampus = zone?.campus ?? venues[0]?.campus ?? "—";
                      const span = Math.max(venues.length, 1);
                      const zoneCell = (
                        <td rowSpan={span} className="px-4 py-3 align-top text-ink">
                          {zone?.name ?? <span className="text-ink-faint">Unassigned</span>}
                        </td>
                      );
                      if (venues.length === 0) {
                        return (
                          <tr key={zone!.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 align-top text-ink-muted">{rowCampus}</td>
                            {zoneCell}
                            <td className="px-4 py-3 text-ink-faint">No venues</td>
                            <td className="px-4 py-3 text-ink-faint">—</td>
                            <td className="px-4 py-3 text-ink-faint">—</td>
                          </tr>
                        );
                      }
                      return (
                        <Fragment key={zone?.id ?? "unassigned"}>
                          {venues.map((v, i) => {
                            const editing = editRoomId === v.id;
                            return (
                              <tr key={v.id} className="border-b border-border last:border-0">
                                {i === 0 && (
                                  <>
                                    <td rowSpan={span} className="px-4 py-3 align-top text-ink-muted">
                                      {rowCampus}
                                    </td>
                                    {zoneCell}
                                  </>
                                )}
                                <td className="px-4 py-3 text-ink">
                                  {editing ? (
                                    <input
                                      value={roomDraft.name}
                                      onChange={(e) => setRoomDraft((d) => ({ ...d, name: e.target.value }))}
                                      className={`${inputClass} py-1 text-sm`}
                                    />
                                  ) : (
                                    v.name
                                  )}
                                </td>
                                <td className="px-4 py-3 text-ink-muted">
                                  {editing ? (
                                    <select
                                      value={roomDraft.spocId}
                                      onChange={(e) => setRoomDraft((d) => ({ ...d, spocId: e.target.value }))}
                                      className={selectClass}
                                    >
                                      <option value="">No SPOC</option>
                                      {spocs.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    (staffById(v.spoc_profile_id) ?? "Unassigned")
                                  )}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  {editing ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <select
                                        value={roomDraft.zoneId}
                                        onChange={(e) => setRoomDraft((d) => ({ ...d, zoneId: e.target.value }))}
                                        className={selectClass}
                                      >
                                        <option value="">No zone</option>
                                        {localZones.map((z) => (
                                          <option key={z.id} value={z.id}>
                                            {z.name}
                                          </option>
                                        ))}
                                      </select>
                                      <button type="button" onClick={() => handleSaveRoom(v)} disabled={busy === `edit-room:${v.id}`} className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-void hover:bg-gold-light disabled:opacity-60">
                                        Save
                                      </button>
                                      <button type="button" onClick={() => setEditRoomId(null)} className="rounded-full border border-border px-3 py-1 text-xs text-ink-muted hover:bg-void">
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-3">
                                      <button type="button" onClick={() => startEditRoom(v)} className="text-xs text-gold underline">
                                        Edit
                                      </button>
                                      <button type="button" onClick={() => handleDeleteRoom(v)} disabled={busy === `del-room:${v.id}`} className="text-xs text-danger underline disabled:opacity-60">
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Teams → Venues */}
            <div className="rounded-xl border border-border bg-surface p-6">
              <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Add Teams Into Venues</span>
              <p className="mt-2 font-heading text-xs text-ink-muted">
                Check one or more teams, pick a Venue, and assign — this is the only place team-to-venue assignment
                happens. A team immediately inherits that Venue&rsquo;s SPOC; SPOCs are never assigned to a team
                directly.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="font-heading text-xs text-ink-muted">Assign selected teams to:</span>
                <select value={bulkRoomId} onChange={(e) => setBulkRoomId(e.target.value)} className={selectClass}>
                  <option value="">Choose a venue…</option>
                  <option value={UNASSIGN}>No venue (unassign)</option>
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
        )}
      </div>
    </div>
  );
}
