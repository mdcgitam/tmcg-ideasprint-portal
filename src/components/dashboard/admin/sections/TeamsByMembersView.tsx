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
import { MembersFilterBar, filterMembers, EMPTY_MEMBER_FILTERS, type MemberFilters, type MemberRow } from "./MembersFilterBar";

// team_id looks like "TeamID01", "TeamID100" — sort on the numeric tail so
// "View All" orders teams by ID number rather than lexicographically.
function teamIdSortKey(teamId: string): number {
  const match = teamId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

const COLUMN_COUNT = 17; // Campus, User ID, Team Name, Name, Position, Email, Reg No, Phone, Year, School, Branch, Stay, Venue, SPOC, NOC, Status, Actions

/**
 * "View by Members" — one row per member, filtered/searched at the member
 * level (item 9-10), with a per-team "Manage Team" panel expandable below
 * that team's last visible row. Venue/SPOC are derived from the team's
 * room, per the room-based assignment model in RoomsZonesSection.
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

  const [filters, setFilters] = useState<MemberFilters>(EMPTY_MEMBER_FILTERS);
  const [sortById, setSortById] = useState(false);

  function handleViewAll() {
    setFilters(EMPTY_MEMBER_FILTERS);
    setSortById(true);
  }

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;

  const allRows: MemberRow[] = useMemo(
    () => teams.flatMap((team) => (membersByTeam[team.id] ?? []).map((member) => ({ member, team }))),
    [teams, membersByTeam],
  );

  const filteredRows = useMemo(() => filterMembers(allRows, filters), [allRows, filters]);

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
        "Member Name": member.name,
        Email: member.gitam_email,
        "Reg./Roll No.": member.reg_no,
        "Year of Study": member.year_of_study,
        "Team Name": team.team_name,
        "Team Lead": (membersByTeam[team.id] ?? []).find((m) => m.is_lead)?.name ?? "—",
        SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
        "Room Number": roomOf(team)?.name ?? "Unassigned",
      })),
    );
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
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Reg Number</th>
                <th className="px-4 py-3">Phone No</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Stay</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">NOC</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((groupRows) => {
                const team = groupRows[0].team;
                const room = roomOf(team);
                const zone = zoneOf(room);
                const ps = psOf(team);
                const isManaging = managingTeamId === team.id;
                const teamMembers = membersByTeam[team.id] ?? [];

                return (
                  <Fragment key={team.id}>
                    {groupRows.map(({ member: m }, rowIndex) => {
                      const noc = localNocs.find((n) => n.profile_id === m.id);
                      const exitRequest = exitRequests.find((r) => r.profile_id === m.id);
                      const isEditingThis = editingMemberId === m.id;

                      return (
                        <Fragment key={m.id}>
                          <tr className="border-b border-border align-top last:border-0">
                            <td className="px-4 py-3 text-ink-muted">{m.campus}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.user_id}</td>
                            <td className="px-4 py-3 text-ink-muted">
                              {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                            </td>
                            <td className="px-4 py-3 text-ink">{m.name}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.gitam_email}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.reg_no}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.phone}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.year_of_study}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.school}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.branch}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.stay}</td>
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
                                {rowIndex === groupRows.length - 1 && (
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
                              <td colSpan={COLUMN_COUNT} className="px-4 py-3">
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
                        <td colSpan={COLUMN_COUNT} className="px-4 py-4">
                          <TeamManagePanel
                            team={team}
                            members={teamMembers}
                            room={room}
                            zone={zone}
                            ps={ps}
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
