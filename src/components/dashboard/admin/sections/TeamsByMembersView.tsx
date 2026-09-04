"use client";

import { Fragment, useMemo, useState } from "react";
import type { TeamRow, NocRow, ExitRequestRow, ProfileRow, RoomRow, ZoneRow, ProblemStatementRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { DashboardActionError } from "@/lib/dashboard/team-actions";
import { deleteMember, updateMember, type UpdateMemberInput } from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";
import { MemberEditForm } from "./TeamFormFields";
import { TeamManagePanel } from "./TeamManagePanel";
import { NocStatus } from "./NocStatus";
import { ExitStatusBadge } from "./ExitStatusBadge";
import { TeamFilterBar, filterTeams, EMPTY_TEAM_FILTERS, type TeamFilters } from "./TeamFilterBar";

// team_id looks like "TeamID01", "TeamID100" — sort on the numeric tail so
// "View All" orders teams by ID number rather than lexicographically.
function teamIdSortKey(teamId: string): number {
  const match = teamId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

interface DownloadRow {
  [key: string]: string;
  "Member Name": string;
  "Reg./Roll No.": string;
  "Year of Study": string;
  "Team Name": string;
  "Team Lead": string;
  SPOC: string;
  "Room Number": string;
}

/**
 * "View by Members" — grouped-by-team member table with search/filters/CSV
 * (item 9-10). Room/Zone/SPOC are derived from the team's room, per the
 * room-based assignment model in RoomsZonesSection.
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
  const [managingTeamId, setManagingTeamId] = useState<string | null>(null);
  const [localNocs, setLocalNocs] = useState(nocs);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<UpdateMemberInput | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TeamFilters>(EMPTY_TEAM_FILTERS);
  const [sortById, setSortById] = useState(false);

  function handleViewAll() {
    setFilters(EMPTY_TEAM_FILTERS);
    setSortById(true);
  }

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;

  const filteredTeams = useMemo(() => {
    const result = filterTeams(teams, membersByTeam, exitRequests, rooms, zones, filters);
    if (sortById) {
      result.sort((a, b) => teamIdSortKey(a.team_id) - teamIdSortKey(b.team_id));
    }
    return result;
  }, [teams, membersByTeam, exitRequests, rooms, zones, filters, sortById]);

  function teamToRows(team: TeamRow): DownloadRow[] {
    const members = membersByTeam[team.id] ?? [];
    const lead = members.find((m) => m.is_lead);
    const room = roomOf(team);
    return members.map((m) => ({
      "Member Name": m.name,
      "Reg./Roll No.": m.reg_no,
      "Year of Study": m.year_of_study,
      "Team Name": team.team_name,
      "Team Lead": lead?.name ?? "—",
      SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
      "Room Number": room?.name ?? "Unassigned",
    }));
  }

  function handleDownloadAllMembers() {
    downloadCsv("all-members", filteredTeams.flatMap(teamToRows));
  }

  async function handleDeleteMember(profileId: string, name: string) {
    if (!window.confirm(`Remove ${name} from their team permanently?`)) return;
    setBusyProfileId(profileId);
    setError(null);
    try {
      await deleteMember(profileId);
      // membersByTeam is server-derived (fetchAdminDashboardData) — reload rather than hand-maintaining a local copy.
      window.location.reload();
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setBusyProfileId(null);
    }
  }

  function startEditMember(m: TeamMemberProfile) {
    setEditingMemberId(m.id);
    setMemberError(null);
    setMemberForm({
      name: m.name,
      gitam_email: m.gitam_email,
      phone: m.phone,
      reg_no: m.reg_no,
      year_of_study: m.year_of_study,
      school: m.school,
      department: m.department,
      branch: m.branch,
      gender: m.gender,
      stay: m.stay,
    });
  }

  function cancelEditMember() {
    setEditingMemberId(null);
    setMemberForm(null);
    setMemberError(null);
  }

  async function handleSaveMember(profileId: string) {
    if (!memberForm) return;
    setSavingMember(true);
    setMemberError(null);
    try {
      await updateMember(profileId, memberForm);
      // membersByTeam is server-derived (fetchAdminDashboardData) — reload rather than hand-maintaining a local copy.
      window.location.reload();
    } catch (err) {
      setMemberError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setSavingMember(false);
    }
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

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      <TeamFilterBar
        filters={filters}
        onChange={setFilters}
        rooms={rooms}
        zones={zones}
        problemStatements={problemStatements}
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

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No teams match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted uppercase">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Reg./Roll No.</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">NOC</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team, teamIndex) => {
                const members = membersByTeam[team.id] ?? [];
                const room = roomOf(team);
                const zone = zoneOf(room);
                const ps = psOf(team);
                const isManaging = managingTeamId === team.id;

                return (
                  <Fragment key={team.id}>
                    {members.map((m, memberIndex) => {
                      const noc = localNocs.find((n) => n.profile_id === m.id);
                      const exitRequest = exitRequests.find((r) => r.profile_id === m.id);
                      const isEditingThis = editingMemberId === m.id;

                      return (
                        <Fragment key={m.id}>
                          <tr className="border-b border-border align-top last:border-0">
                            <td className="px-4 py-3 text-ink-faint">{teamIndex + 1}</td>
                            <td className="px-4 py-3">
                              <p className="text-ink">
                                {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                              </p>
                              <p className="mt-0.5 text-xs text-ink-muted">
                                {m.user_id} · {m.gitam_email}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-ink-muted">{m.reg_no}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.year_of_study}</td>
                            <td className="px-4 py-3 text-ink-muted">
                              {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                            </td>
                            <td className="px-4 py-3 text-ink-muted">{room?.name ?? "Unassigned"}</td>
                            <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                            <td className="px-4 py-3 text-ink-muted">
                              <NocStatus
                                profileId={m.id}
                                noc={noc}
                                onDeleted={() =>
                                  setLocalNocs((prev) =>
                                    prev.map((n) =>
                                      n.profile_id === m.id ? { ...n, status: "Not Uploaded", file_path: null } : n,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td className="px-4 py-3">
                              <ExitStatusBadge request={exitRequest} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {scope === "admin" && (
                                  <button
                                    type="button"
                                    onClick={() => (isEditingThis ? cancelEditMember() : startEditMember(m))}
                                    className="text-gold underline"
                                  >
                                    {isEditingThis ? "Cancel" : "Edit"}
                                  </button>
                                )}
                                {scope === "admin" && !m.is_lead && (
                                  <button
                                    type="button"
                                    disabled={busyProfileId === m.id}
                                    onClick={() => handleDeleteMember(m.id, m.name)}
                                    className="text-danger underline disabled:opacity-60"
                                  >
                                    Remove
                                  </button>
                                )}
                                {memberIndex === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setManagingTeamId(isManaging ? null : team.id)}
                                    className="text-ink-muted underline"
                                  >
                                    {isManaging ? "Hide Team" : "Manage Team"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {scope === "admin" && isEditingThis && memberForm && (
                            <tr className="border-b border-border bg-void/40">
                              <td colSpan={10} className="px-4 py-3">
                                <MemberEditForm
                                  form={memberForm}
                                  onChange={setMemberForm}
                                  onSave={() => handleSaveMember(m.id)}
                                  onCancel={cancelEditMember}
                                  saving={savingMember}
                                  error={memberError}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {isManaging && (
                      <tr className="border-b border-border bg-void/40">
                        <td colSpan={10} className="px-4 py-4">
                          <TeamManagePanel
                            team={team}
                            members={members}
                            room={room}
                            zone={zone}
                            ps={ps}
                            exitedCount={members.filter((m) => exitRequests.find((r) => r.profile_id === m.id)?.status === "Approved").length}
                            spocName={spocName(team.spoc_profile_id)}
                            scope={scope}
                            onTeamRenamed={onTeamRenamed}
                            onTeamDeleted={(teamId) => {
                              setManagingTeamId(null);
                              onTeamDeleted(teamId);
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
