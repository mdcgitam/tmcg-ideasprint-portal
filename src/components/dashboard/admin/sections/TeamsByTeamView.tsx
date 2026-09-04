"use client";

import { useMemo, useState } from "react";
import type {
  AttendanceRow,
  AttendanceSessionRow,
  ExitRequestRow,
  NocRow,
  ProblemStatementRow,
  ProfileRow,
  RoomRow,
  TeamRow,
  ZoneRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { TeamDetailModal } from "./TeamDetailModal";
import { TeamFilterBar, filterTeams, EMPTY_TEAM_FILTERS, type TeamFilters } from "./TeamFilterBar";

/** "View by Team" — one row per team, matching "View by Members"' table styling. Actions opens the full team detail view. */
export function TeamsByTeamView({
  teams,
  membersByTeam,
  problemStatements,
  rooms,
  zones,
  staffAccounts,
  exitRequests,
  nocs,
  attendance,
  attendanceSessions,
  scope,
  onTeamRenamed,
  onTeamDeleted,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  problemStatements: ProblemStatementRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  exitRequests: ExitRequestRow[];
  nocs: NocRow[];
  attendance: AttendanceRow[];
  attendanceSessions: AttendanceSessionRow[];
  scope: "spoc" | "admin";
  onTeamRenamed: (teamId: string, name: string) => void;
  onTeamDeleted: (teamId: string) => void;
}) {
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TeamFilters>(EMPTY_TEAM_FILTERS);

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;
  const latestSession = attendanceSessions[attendanceSessions.length - 1] ?? null;

  const filteredTeams = useMemo(
    () => filterTeams(teams, membersByTeam, exitRequests, rooms, zones, filters),
    [teams, membersByTeam, exitRequests, rooms, zones, filters],
  );

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          {scope === "admin" ? "No teams registered yet." : "No teams assigned to you yet."}
        </p>
      </div>
    );
  }

  const openTeam = teams.find((t) => t.id === openTeamId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <TeamFilterBar filters={filters} onChange={setFilters} rooms={rooms} zones={zones} problemStatements={problemStatements} />

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No teams match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted uppercase">
                <th className="px-4 py-3">Team ID</th>
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3">Lead Phone</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team) => {
                const members = membersByTeam[team.id] ?? [];
                const lead = members.find((m) => m.is_lead);
                const room = roomOf(team);
                const exitedCount = members.filter(
                  (m) => exitRequests.find((r) => r.profile_id === m.id)?.status === "Approved",
                ).length;
                const presentCount = latestSession
                  ? members.filter(
                      (m) => attendance.find((a) => a.session_id === latestSession.id && a.profile_id === m.id)?.status === "Present",
                    ).length
                  : 0;

                return (
                  <tr key={team.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3 text-ink-muted">{team.team_id}</td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{team.team_name}</td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.school ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{members.length}</td>
                    <td className="px-4 py-3 text-ink-muted">{room?.name ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {latestSession ? `${presentCount}/${members.length} Present` : "No sessions yet"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {exitedCount > 0 ? `${exitedCount} Exited` : "Active"}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setOpenTeamId(team.id)} className="text-gold underline">
                        View
                      </button>
                    </td>
                  </tr>
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
