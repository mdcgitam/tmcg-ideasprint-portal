"use client";

import { useMemo, useState } from "react";
import type { ExitRequestRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { sortCampuses } from "@/lib/dashboard/campus-config";
import { FilterSelect } from "./TeamFormFields";
import { ExitReviewModal } from "./ExitReviewModal";

/** "Teams" view of Exit Requests — every team, with how many active members currently have an open exit form; View opens the review popup. */
export function ExitTeamsView({
  teams,
  membersByTeam,
  exitRequests,
  rooms,
  zones,
  staffAccounts,
  singleCampus = false,
  hideZoneFilters = false,
  hideVenueFilter = false,
  hideSpocFilter = false,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  exitRequests: ExitRequestRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  singleCampus?: boolean;
  hideZoneFilters?: boolean;
  hideVenueFilter?: boolean;
  hideSpocFilter?: boolean;
}) {
  const [localRequests, setLocalRequests] = useState(exitRequests);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  const [campusFilter, setCampusFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [zoneManagerFilter, setZoneManagerFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [spocFilter, setSpocFilter] = useState("");
  const [search, setSearch] = useState("");

  const leadOf = (team: TeamRow) => (membersByTeam[team.id] ?? []).find((m) => m.is_lead) ?? null;
  const campusOf = (team: TeamRow) => leadOf(team)?.campus ?? team.campus;
  const roomOf = (team: TeamRow) => (team.room_id ? (rooms.find((r) => r.id === team.room_id) ?? null) : null);
  const zoneOf = (team: TeamRow) => {
    const room = roomOf(team);
    return room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null;
  };
  const spocName = (team: TeamRow) => (team.spoc_profile_id ? (staffAccounts.find((s) => s.id === team.spoc_profile_id)?.name ?? null) : null);
  const zoneManagerName = (team: TeamRow) => {
    const zm = zoneOf(team)?.zone_manager_profile_id;
    return zm ? (staffAccounts.find((s) => s.id === zm)?.name ?? null) : null;
  };

  function openRequestCountFor(team: TeamRow): { open: number; active: number } {
    const active = (membersByTeam[team.id] ?? []).filter((m) => m.is_active);
    const open = active.filter((m) => localRequests.some((r) => r.profile_id === m.id && r.status === "Requested")).length;
    return { open, active: active.length };
  }

  const campusOptions = useMemo(() => sortCampuses(Array.from(new Set(teams.map(campusOf)))), [teams]); // eslint-disable-line react-hooks/exhaustive-deps
  const sizeOptions = useMemo(() => Array.from(new Set(teams.map((t) => t.member_count))).sort((a, b) => a - b), [teams]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      const lead = leadOf(t);
      if (q) {
        const haystack = `${t.team_name} ${t.team_id} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (campusFilter && campusOf(t) !== campusFilter) return false;
      if (sizeFilter && String(t.member_count) !== sizeFilter) return false;
      if (zoneFilter && zoneOf(t)?.id !== zoneFilter) return false;
      if (zoneManagerFilter && zoneOf(t)?.zone_manager_profile_id !== zoneManagerFilter) return false;
      if (venueFilter && t.room_id !== venueFilter) return false;
      if (spocFilter && t.spoc_profile_id !== spocFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, membersByTeam, search, campusFilter, sizeFilter, zoneFilter, zoneManagerFilter, venueFilter, spocFilter]);

  const openTeam = openTeamId ? (teams.find((t) => t.id === openTeamId) ?? null) : null;
  const columnCount =
    (singleCampus ? 0 : 1) + 5 + (hideZoneFilters ? 0 : 2) + (hideVenueFilter ? 0 : 1) + (hideSpocFilter ? 0 : 1) + 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!singleCampus && (
          <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={campusOptions} valueOptions={campusOptions} />
        )}
        <FilterSelect label="Team Size" value={sizeFilter} onChange={setSizeFilter} options={sizeOptions.map(String)} valueOptions={sizeOptions.map(String)} />
        {!hideZoneFilters && (
          <>
            <FilterSelect label="Zone" value={zoneFilter} onChange={setZoneFilter} options={zones.map((z) => z.name)} valueOptions={zones.map((z) => z.id)} />
            <FilterSelect
              label="Zone Manager"
              value={zoneManagerFilter}
              onChange={setZoneManagerFilter}
              options={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.name)}
              valueOptions={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.id)}
            />
          </>
        )}
        {!hideVenueFilter && (
          <FilterSelect label="Venue" value={venueFilter} onChange={setVenueFilter} options={rooms.map((r) => r.name)} valueOptions={rooms.map((r) => r.id)} />
        )}
        {!hideSpocFilter && (
          <FilterSelect
            label="SPOC"
            value={spocFilter}
            onChange={setSpocFilter}
            options={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.name)}
            valueOptions={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.id)}
          />
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, lead, or phone…"
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                {!singleCampus && <th className="px-4 py-3">Campus</th>}
                <th className="px-4 py-3">Team ID</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3">Lead Phone</th>
                <th className="px-4 py-3">Team Size</th>
                {!hideZoneFilters && (
                  <>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Zone Manager</th>
                  </>
                )}
                {!hideVenueFilter && <th className="px-4 py-3">Venue</th>}
                {!hideSpocFilter && <th className="px-4 py-3">SPOC</th>}
                <th className="px-4 py-3">Uploads</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-ink-muted">
                    No teams match the current filters.
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => {
                  const lead = leadOf(team);
                  const { open, active } = openRequestCountFor(team);
                  return (
                    <tr key={team.id} className="border-b border-border align-top last:border-0">
                      {!singleCampus && <td className="px-4 py-3 text-ink-muted">{campusOf(team)}</td>}
                      <td className="px-4 py-3 text-ink-muted">{team.team_id}</td>
                      <td className="px-4 py-3 text-ink">{team.team_name}</td>
                      <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-muted">{team.member_count}</td>
                      {!hideZoneFilters && (
                        <>
                          <td className="px-4 py-3 text-ink-muted">{zoneOf(team)?.name ?? "Unassigned"}</td>
                          <td className="px-4 py-3 text-ink-muted">{zoneManagerName(team) ?? "Unassigned"}</td>
                        </>
                      )}
                      {!hideVenueFilter && <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>}
                      {!hideSpocFilter && <td className="px-4 py-3 text-ink-muted">{spocName(team) ?? "Unassigned"}</td>}
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-3 py-1 text-xs ${open > 0 ? "border-gold/40 bg-gold/10 text-gold" : "border-border text-ink-muted"}`}>
                          {open}/{active}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setOpenTeamId(team.id)}
                          className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openTeam && (
        <ExitReviewModal
          team={openTeam}
          members={membersByTeam[openTeam.id] ?? []}
          exitRequests={localRequests}
          rooms={rooms}
          zones={zones}
          staffAccounts={staffAccounts}
          onRequestsChanged={setLocalRequests}
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </div>
  );
}
