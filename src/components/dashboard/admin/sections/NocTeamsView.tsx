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
import { extendNocDeadline, DashboardActionError } from "@/lib/dashboard/team-actions";
import { downloadCsv } from "@/lib/csv";
import { FilterSelect } from "./TeamFormFields";
import { TeamDetailModal } from "./TeamDetailModal";

/** "Teams" view of the NOC page (NOC1/NOC2 reference) — one row per team. */
export function NocTeamsView({
  teams,
  membersByTeam,
  nocs,
  attendance,
  attendanceSessions,
  rooms,
  zones,
  staffAccounts,
  problemStatements,
  exitRequests,
  scope,
  onTeamRenamed,
  onTeamDeleted,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  attendance: AttendanceRow[];
  attendanceSessions: AttendanceSessionRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  problemStatements: ProblemStatementRow[];
  exitRequests: ExitRequestRow[];
  scope: "spoc" | "admin";
  onTeamRenamed: (teamId: string, name: string) => void;
  onTeamDeleted: (teamId: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  const [teamSizeFilter, setTeamSizeFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [venueFilter, setVenueFilter] = useState("");
  const [spocFilter, setSpocFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;
  const latestSession = attendanceSessions[attendanceSessions.length - 1] ?? null;

  function uploadedCount(team: TeamRow) {
    const members = membersByTeam[team.id] ?? [];
    return members.filter((m) => nocs.find((n) => n.profile_id === m.id)?.status === "Uploaded").length;
  }

  function teamAttendance(team: TeamRow): "Present" | "Absent" | null {
    if (!latestSession) return null;
    const members = membersByTeam[team.id] ?? [];
    if (members.length === 0) return null;
    const presentCount = members.filter(
      (m) => attendance.find((a) => a.session_id === latestSession.id && a.profile_id === m.id)?.status === "Present",
    ).length;
    return presentCount === members.length ? "Present" : presentCount === 0 ? "Absent" : "Present";
  }

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((team) => {
      const members = membersByTeam[team.id] ?? [];
      const lead = members.find((m) => m.is_lead);

      if (q) {
        const haystack = `${team.team_name} ${team.team_id} ${lead?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (teamSizeFilter && String(team.member_count) !== teamSizeFilter) return false;
      if (attendanceFilter && teamAttendance(team) !== attendanceFilter) return false;
      if (venueFilter && team.room_id !== venueFilter) return false;
      if (spocFilter && team.spoc_profile_id !== spocFilter) return false;
      if (statusFilter) {
        const complete = uploadedCount(team) === members.length && members.length > 0;
        if (statusFilter === "completed" && !complete) return false;
        if (statusFilter === "pending" && complete) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, membersByTeam, search, teamSizeFilter, attendanceFilter, venueFilter, spocFilter, statusFilter, nocs, attendance]);

  function toggleSelected(teamId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  async function handleBulkExtend() {
    if (!bulkDeadline || selected.size === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const deadlineIso = new Date(bulkDeadline).toISOString();
      const profileIds = Array.from(selected).flatMap((teamId) => (membersByTeam[teamId] ?? []).map((m) => m.id));
      await Promise.all(profileIds.map((id) => extendNocDeadline(id, deadlineIso)));
      setSelected(new Set());
      setBulkDeadline("");
    } catch (err) {
      setBulkError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBulkBusy(false);
    }
  }

  function handleExportCsv() {
    downloadCsv(
      "noc-teams",
      filteredTeams.map((team) => {
        const members = membersByTeam[team.id] ?? [];
        const lead = members.find((m) => m.is_lead);
        return {
          Campus: lead?.campus ?? "—",
          "Team Name": team.team_name,
          "Team Lead": lead?.name ?? "—",
          "Team Size": String(team.member_count),
          Attendance: teamAttendance(team) ?? "No sessions yet",
          Venue: roomOf(team)?.name ?? "Unassigned",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          "No. of Uploads": `${uploadedCount(team)}/${members.length}`,
          Status: uploadedCount(team) === members.length && members.length > 0 ? "Completed" : "Pending",
        };
      }),
    );
  }

  const openTeam = teams.find((t) => t.id === openTeamId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Bulk Extend Deadline (selected teams)</span>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="datetime-local"
            value={bulkDeadline}
            onChange={(e) => setBulkDeadline(e.target.value)}
            className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={bulkBusy || !bulkDeadline || selected.size === 0}
            onClick={handleBulkExtend}
            className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {bulkBusy ? "Applying…" : "Apply Bulk Extend"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Export CSV
          </button>
          <span className="font-heading text-xs text-ink-muted">Selected: {selected.size} team(s)</span>
        </div>
        {bulkError && <p className="font-heading text-xs text-danger">{bulkError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4">
        <FilterSelect label="Team Size" value={teamSizeFilter} onChange={setTeamSizeFilter} options={["3", "4"]} />
        <FilterSelect
          label="Attendance"
          value={attendanceFilter}
          onChange={setAttendanceFilter}
          options={["Present", "Absent"]}
        />
        <FilterSelect
          label="Venue"
          value={venueFilter}
          onChange={setVenueFilter}
          options={rooms.map((r) => r.name)}
          valueOptions={rooms.map((r) => r.id)}
        />
        <FilterSelect
          label="SPOC"
          value={spocFilter}
          onChange={setSpocFilter}
          options={staffAccounts.map((s) => s.name)}
          valueOptions={staffAccounts.map((s) => s.id)}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={["Completed", "Pending"]}
          valueOptions={["completed", "pending"]}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Team name / lead…"
          className="min-w-[180px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
        />
      </div>

      <p className="font-heading text-xs text-ink-muted">Showing {filteredTeams.length} teams</p>

      {filteredTeams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">No teams match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted uppercase">
                <th className="px-4 py-3" />
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Team Lead</th>
                <th className="px-4 py-3">Team Size</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Venue</th>
                <th className="px-4 py-3">SPOC</th>
                <th className="px-4 py-3">No. of Uploads</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map((team) => {
                const members = membersByTeam[team.id] ?? [];
                const lead = members.find((m) => m.is_lead);
                const complete = uploadedCount(team) === members.length && members.length > 0;
                return (
                  <tr key={team.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(team.id)}
                        onChange={() => toggleSelected(team.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">
                      {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{team.member_count}</td>
                    <td className="px-4 py-3 text-ink-muted">{teamAttendance(team) ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {uploadedCount(team)}/{members.length}
                    </td>
                    <td className="px-4 py-3">
                      <span className={complete ? "text-gitam" : "text-gold"}>{complete ? "Completed" : "Pending"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setOpenTeamId(team.id)} className="text-gold underline">
                        Open
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
