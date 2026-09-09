import { type ReactNode, useMemo } from "react";
import type { ExitRequestRow, RoomRow, TeamRow, ProfileRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { FilterSelect } from "./TeamFormFields";
import { TEAM_STATUS_OPTIONS, activeMemberCount, teamActiveStatus } from "./ExitStatusBadge";

export interface TeamFilters {
  search: string;
  campus: string;
  teamSize: string;
  zone: string;
  zoneManager: string;
  room: string;
  spoc: string;
  status: string;
}

export const EMPTY_TEAM_FILTERS: TeamFilters = {
  search: "",
  campus: "",
  teamSize: "",
  zone: "",
  zoneManager: "",
  room: "",
  spoc: "",
  status: "",
};

/** "View by Teams"' filter set — Campus / Team Size / Zone / Zone Manager / Venue / SPOC / Status. Search matches Team Name, Team ID, Team Lead, and Lead Phone No only. */
export function filterTeams(
  teams: TeamRow[],
  membersByTeam: Record<string, TeamMemberProfile[]>,
  filters: TeamFilters,
  rooms: RoomRow[],
  zones: ZoneRow[],
): TeamRow[] {
  const q = filters.search.trim().toLowerCase();
  return teams.filter((team) => {
    const members = membersByTeam[team.id] ?? [];
    const lead = members.find((m) => m.is_lead);
    const room = rooms.find((r) => r.id === team.room_id);

    if (q) {
      const haystack = `${team.team_name} ${team.team_id} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.campus && lead?.campus !== filters.campus) return false;
    if (filters.teamSize && String(activeMemberCount(members) || team.member_count) !== filters.teamSize) return false;
    if (filters.zone) {
      if (!room || room.zone_id !== filters.zone) return false;
    }
    if (filters.zoneManager) {
      const zone = room ? zones.find((z) => z.id === room.zone_id) : null;
      if (!zone || zone.zone_manager_profile_id !== filters.zoneManager) return false;
    }
    if (filters.room && team.room_id !== filters.room) return false;
    if (filters.spoc && team.spoc_profile_id !== filters.spoc) return false;
    if (filters.status && teamActiveStatus(members) !== filters.status) return false;
    return true;
  });
}

export function TeamFilterBar({
  filters,
  onChange,
  teams,
  membersByTeam,
  rooms,
  zones,
  staffAccounts,
  extraActions,
  singleCampus = false,
  hideZoneFilters = false,
  hideVenueFilter = false,
  hideSpocFilter = false,
}: {
  filters: TeamFilters;
  onChange: (next: TeamFilters) => void;
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  exitRequests: ExitRequestRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  extraActions?: ReactNode;
  /** Hide the Campus filter when the view is locked to one campus. */
  singleCampus?: boolean;
  /** Hide the Zone/Zone Manager filters — always a single value for this viewer (Zone Manager, SPOC). */
  hideZoneFilters?: boolean;
  /** Hide the Venue filter — always a single value for this viewer (SPOC). */
  hideVenueFilter?: boolean;
  /** Hide the SPOC filter — always a single value for this viewer (SPOC). */
  hideSpocFilter?: boolean;
}) {
  function set<K extends keyof TeamFilters>(key: K, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const campusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          teams
            .map((t) => (membersByTeam[t.id] ?? []).find((m) => m.is_lead)?.campus)
            .filter((c): c is NonNullable<typeof c> => Boolean(c)),
        ),
      ),
    [teams, membersByTeam],
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search by team name, team ID, team lead, or lead phone no…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        {extraActions}
      </div>
      <div className="flex flex-wrap gap-2">
        {!singleCampus && (
          <FilterSelect label="Campus" value={filters.campus} onChange={(v) => set("campus", v)} options={campusOptions} />
        )}
        <FilterSelect label="Team Size" value={filters.teamSize} onChange={(v) => set("teamSize", v)} options={["3", "4"]} />
        {!hideZoneFilters && (
          <>
            <FilterSelect
              label="Zone"
              value={filters.zone}
              onChange={(v) => set("zone", v)}
              options={zones.map((z) => z.name)}
              valueOptions={zones.map((z) => z.id)}
            />
            <FilterSelect
              label="Zone Manager"
              value={filters.zoneManager}
              onChange={(v) => set("zoneManager", v)}
              options={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.name)}
              valueOptions={staffAccounts.filter((s) => s.role === "Zone Manager").map((s) => s.id)}
            />
          </>
        )}
        {!hideVenueFilter && (
          <FilterSelect
            label="Venue"
            value={filters.room}
            onChange={(v) => set("room", v)}
            options={rooms.map((r) => r.name)}
            valueOptions={rooms.map((r) => r.id)}
          />
        )}
        {!hideSpocFilter && (
          <FilterSelect
            label="SPOC"
            value={filters.spoc}
            onChange={(v) => set("spoc", v)}
            options={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.name)}
            valueOptions={staffAccounts.filter((s) => s.role === "SPOC").map((s) => s.id)}
          />
        )}
        <FilterSelect label="Status" value={filters.status} onChange={(v) => set("status", v)} options={[...TEAM_STATUS_OPTIONS]} />
      </div>
    </div>
  );
}
