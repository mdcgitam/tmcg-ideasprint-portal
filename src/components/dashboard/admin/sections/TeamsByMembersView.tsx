"use client";

import { Fragment, useMemo, useState } from "react";
import type { TeamRow, NocRow, ExitRequestRow, ProfileRow, RoomRow, ZoneRow, ProblemStatementRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { downloadCsv } from "@/lib/csv";
import { ExitStatusBadge } from "./ExitStatusBadge";
import { MembersFilterBar, filterMembers, EMPTY_MEMBER_FILTERS, type MemberFilters, type MemberRow } from "./MembersFilterBar";
import { TeamDetailModal } from "./TeamDetailModal";

// team_id looks like "TeamID01", "TeamID100" — sort on the numeric tail so
// "View All" orders teams by ID number rather than lexicographically.
function teamIdSortKey(teamId: string): number {
  const match = teamId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * "View by Participants" — one row per member, filtered/searched at the
 * member level, with a View button that opens the full TeamDetailModal
 * (same as View by Teams). Venue/SPOC are derived from the team's room, per
 * the room-based assignment model in RoomsZonesSection.
 */
export function TeamsByMembersView({
  teams,
  membersByTeam,
  nocs,
  exitRequests,
  scope,
  staffAccounts,
  rooms,
  zones,
  problemStatements,
  onTeamRenamed,
  onTeamDeleted,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  exitRequests: ExitRequestRow[];
  scope: "spoc" | "admin";
  staffAccounts: ProfileRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  problemStatements: ProblemStatementRow[];
  onTeamRenamed: (teamId: string, name: string) => void;
  onTeamDeleted: (teamId: string) => void;
}) {
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [filters, setFilters] = useState<MemberFilters>(EMPTY_MEMBER_FILTERS);
  const [sortById, setSortById] = useState(false);

  function handleViewAll() {
    setFilters(EMPTY_MEMBER_FILTERS);
    setSortById(true);
  }

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  // Live roster length — the stored teams.member_count can lag a member deletion.
  const teamSize = (team: TeamRow) => (membersByTeam[team.id] ?? []).length || team.member_count;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;

  const allRows: MemberRow[] = useMemo(
    () => teams.flatMap((team) => (membersByTeam[team.id] ?? []).map((member) => ({ member, team }))),
    [teams, membersByTeam],
  );

  const filteredRows = useMemo(() => filterMembers(allRows, filters, exitRequests), [allRows, filters, exitRequests]);

  const groups = useMemo(() => {
    const map = new Map<string, MemberRow[]>();
    for (const row of filteredRows) {
      const list = map.get(row.team.id) ?? [];
      list.push(row);
      map.set(row.team.id, list);
    }
    const entries = Array.from(map.values());
    if (sortById) {
      entries.sort((a, b) => teamIdSortKey(a[0].team.team_id) - teamIdSortKey(b[0].team.team_id));
    }
    return entries;
  }, [filteredRows, sortById]);

  function handleDownloadAllMembers() {
    downloadCsv(
      "all-members",
      filteredRows.map(({ member, team }) => ({
        "Participant Name": member.name,
        Email: member.gitam_email,
        "Reg No": member.reg_no,
        Graduation: member.graduation ?? "",
        Program: member.program ?? "",
        Year: member.year_of_study,
        "Team Name": team.team_name,
        "Team Size": String(teamSize(team)),
        "Team Lead": (membersByTeam[team.id] ?? []).find((m) => m.is_lead)?.name ?? "—",
        SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
        "Room Number": roomOf(team)?.name ?? "Unassigned",
      })),
    );
  }

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          {scope === "admin" ? "No teams registered yet." : "No teams assigned to you yet."}
        </p>
      </div>
    );
  }

  const openTeam = openTeamId ? (teams.find((t) => t.id === openTeamId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <MembersFilterBar
        filters={filters}
        onChange={setFilters}
        rows={allRows}
        rooms={rooms}
        staffAccounts={staffAccounts}
        sortById={sortById}
        onToggleSort={handleViewAll}
        extraActions={
          <button
            type="button"
            onClick={handleDownloadAllMembers}
            className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Download All Members (CSV)
          </button>
        }
      />

      <p className="font-heading text-xs text-ink-muted">Showing {filteredRows.length} members</p>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No members match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Team Size</th>
                <th className="px-4 py-3">Participant Name</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Reg No</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Graduation</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Stay</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((groupRows) => {
                const team = groupRows[0].team;
                const room = roomOf(team);

                return (
                  <Fragment key={team.id}>
                    {groupRows.map(({ member: m }) => {
                      const exitRequest = exitRequests.find((r) => r.profile_id === m.id);

                      return (
                        <tr key={m.id} className="border-b border-border align-top last:border-0">
                          <td className="px-4 py-3 text-ink-muted">{m.campus}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.user_id}</td>
                          <td className="px-4 py-3 text-ink-muted">
                            {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                          </td>
                          <td className="px-4 py-3 text-ink-muted">{teamSize(team)}</td>
                          <td className="px-4 py-3 text-ink">{m.name}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.reg_no}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.gitam_email}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.phone}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.graduation ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.program ?? "—"}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.year_of_study}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.school}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.department}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.branch}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.gender}</td>
                          <td className="px-4 py-3 text-ink-muted">{m.stay}</td>
                          <td className="px-4 py-3 text-ink-muted">{room?.name ?? "Unassigned"}</td>
                          <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                          <td className="px-4 py-3">
                            <ExitStatusBadge request={exitRequest} />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setOpenTeamId(team.id)}
                              className="text-gold underline"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openTeam && (
        <TeamDetailModal
          team={openTeam}
          members={membersByTeam[openTeam.id] ?? []}
          room={roomOf(openTeam)}
          zone={zoneOf(roomOf(openTeam))}
          ps={psOf(openTeam)}
          exitRequests={exitRequests}
          nocs={nocs}
          spocName={spocName(openTeam.spoc_profile_id)}
          scope={scope}
          onTeamRenamed={onTeamRenamed}
          onTeamDeleted={(teamId) => {
            setOpenTeamId(null);
            onTeamDeleted(teamId);
          }}
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </div>
  );
}
