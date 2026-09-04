import type { ReactNode } from "react";
import type { ExitRequestRow, ProblemStatementRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { FilterSelect, YEAR_OPTIONS, GENDER_OPTIONS } from "./TeamFormFields";

export interface TeamFilters {
  search: string;
  year: string;
  gender: string;
  room: string;
  zone: string;
  ps: string;
  teamSize: string;
  status: string; // "" | "active" | "exited"
}

export const EMPTY_TEAM_FILTERS: TeamFilters = {
  search: "",
  year: "",
  gender: "",
  room: "",
  zone: "",
  ps: "",
  teamSize: "",
  status: "",
};

/** Shared by TeamsByTeamView and TeamsByMembersView — same filter set + search in both (item 3). */
export function filterTeams(
  teams: TeamRow[],
  membersByTeam: Record<string, TeamMemberProfile[]>,
  exitRequests: ExitRequestRow[],
  rooms: RoomRow[],
  zones: ZoneRow[],
  filters: TeamFilters,
): TeamRow[] {
  const q = filters.search.trim().toLowerCase();
  return teams.filter((team) => {
    const members = membersByTeam[team.id] ?? [];
    const room = rooms.find((r) => r.id === team.room_id) ?? null;
    const zone = room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null;

    if (q) {
      const haystack = [team.team_name, team.team_id, ...members.map((m) => `${m.name} ${m.user_id} ${m.reg_no}`)]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.year && !members.some((m) => m.year_of_study === filters.year)) return false;
    if (filters.gender && !members.some((m) => m.gender === filters.gender)) return false;
    if (filters.room && team.room_id !== filters.room) return false;
    if (filters.zone && zone?.id !== filters.zone) return false;
    if (filters.ps && team.current_problem_statement_id !== filters.ps) return false;
    if (filters.teamSize && String(team.member_count) !== filters.teamSize) return false;
    if (filters.status) {
      const hasExited = members.some((m) => exitRequests.find((r) => r.profile_id === m.id)?.status === "Approved");
      if (filters.status === "exited" && !hasExited) return false;
      if (filters.status === "active" && hasExited) return false;
    }
    return true;
  });
}

export function TeamFilterBar({
  filters,
  onChange,
  rooms,
  zones,
  problemStatements,
  extraActions,
  sortById,
  onToggleSort,
}: {
  filters: TeamFilters;
  onChange: (next: TeamFilters) => void;
  rooms: RoomRow[];
  zones: ZoneRow[];
  problemStatements: ProblemStatementRow[];
  extraActions?: ReactNode;
  sortById?: boolean;
  onToggleSort?: () => void;
}) {
  function set<K extends keyof TeamFilters>(key: K, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search by team, name, reg no, user ID…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
        {extraActions}
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterSelect label="Year" value={filters.year} onChange={(v) => set("year", v)} options={YEAR_OPTIONS} />
        <FilterSelect label="Gender" value={filters.gender} onChange={(v) => set("gender", v)} options={GENDER_OPTIONS} />
        <FilterSelect
          label="Room / SPOC"
          value={filters.room}
          onChange={(v) => set("room", v)}
          options={rooms.map((r) => r.name)}
          valueOptions={rooms.map((r) => r.id)}
        />
        <FilterSelect
          label="Zone"
          value={filters.zone}
          onChange={(v) => set("zone", v)}
          options={zones.map((z) => z.name)}
          valueOptions={zones.map((z) => z.id)}
        />
        <FilterSelect
          label="Problem Statement"
          value={filters.ps}
          onChange={(v) => set("ps", v)}
          options={problemStatements.map((p) => p.number)}
          valueOptions={problemStatements.map((p) => p.id)}
        />
        <FilterSelect label="Team Size" value={filters.teamSize} onChange={(v) => set("teamSize", v)} options={["3", "4"]} />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => set("status", v)}
          options={["Active", "Exited"]}
          valueOptions={["active", "exited"]}
        />
        {onToggleSort && (
          <button
            type="button"
            onClick={onToggleSort}
            className={`rounded-lg border px-3 py-1.5 font-heading text-xs transition-colors ${
              sortById ? "border-gold bg-gold/10 text-gold" : "border-border text-ink-muted hover:border-gold hover:text-gold"
            }`}
          >
            View All (by ID)
          </button>
        )}
      </div>
    </div>
  );
}
