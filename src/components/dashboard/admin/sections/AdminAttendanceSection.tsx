"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AttendanceRow, AttendanceSessionRow, ProfileRow, RoomRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { recordAttendance, createAttendanceSession, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { FilterSelect } from "@/components/dashboard/admin/sections/TeamFormFields";
import { useTabFade } from "@/hooks/useTabFade";

type View = "teams" | "members";
type Status = "Present" | "Absent" | "Not Marked";

interface TeamFilters {
  search: string;
  campus: string;
  teamSize: string;
  room: string;
  spoc: string;
  status: string; // "" | "Present" | "Absent" | "Not Marked"
}

const EMPTY_TEAM_FILTERS: TeamFilters = { search: "", campus: "", teamSize: "", room: "", spoc: "", status: "" };

interface MemberFilters {
  search: string;
  campus: string;
  teamSize: string;
  stay: string;
  room: string;
  spoc: string;
  position: string; // "" | "lead" | "member"
  sessionStatus: Record<string, string>; // session_id -> "" | "Present" | "Absent"
}

const EMPTY_MEMBER_FILTERS: MemberFilters = {
  search: "",
  campus: "",
  teamSize: "",
  stay: "",
  room: "",
  spoc: "",
  position: "",
  sessionStatus: {},
};

function uniqueValues(values: (string | undefined | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v))));
}

/** Both Super Admin and SPOC can create sessions and mark attendance — SPOC for their own assigned teams (RLS-scoped), Super Admin for any team (record_attendance's own `current_role() = 'Super Admin'` check). */
export function AdminAttendanceSection({
  teams,
  membersByTeam,
  attendanceSessions,
  attendance,
  scope,
  staffAccounts,
  spocs,
  rooms,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  attendanceSessions: AttendanceSessionRow[];
  attendance: AttendanceRow[];
  scope: "spoc" | "admin";
  staffAccounts: ProfileRow[];
  spocs: ProfileRow[];
  rooms: RoomRow[];
}) {
  const [localSessions, setLocalSessions] = useState(attendanceSessions);
  const [localAttendance, setLocalAttendance] = useState(attendance);
  const [sessionName, setSessionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("teams");
  const fadeRef = useTabFade(view);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());

  const [teamFilters, setTeamFilters] = useState<TeamFilters>(EMPTY_TEAM_FILTERS);
  const [memberFilters, setMemberFilters] = useState<MemberFilters>(EMPTY_MEMBER_FILTERS);

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  // Live roster length — the stored teams.member_count can lag a member deletion.
  const teamSize = (team: TeamRow) => (membersByTeam[team.id] ?? []).length || team.member_count;
  const latestSession = localSessions[localSessions.length - 1] ?? null;

  function toggleExpanded(teamId: string) {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createAttendanceSession(sessionName.trim(), null, null, localSessions.length);
      setLocalSessions((prev) => [
        ...prev,
        { id, name: sessionName.trim(), starts_at: null, ends_at: null, sort_order: prev.length },
      ]);
      setSessionName("");
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  function applyLocalStatus(sessionId: string, profileId: string, teamId: string, status: "Present" | "Absent") {
    setLocalAttendance((prev) => {
      const existing = prev.find((a) => a.session_id === sessionId && a.profile_id === profileId);
      if (existing) {
        return prev.map((a) => (a === existing ? { ...a, status } : a));
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          session_id: sessionId,
          profile_id: profileId,
          team_id: teamId,
          status,
          recorded_by: "",
          recorded_at: new Date().toISOString(),
        },
      ];
    });
  }

  async function handleToggleMember(sessionId: string, profileId: string, teamId: string, current: Status) {
    const next: "Present" | "Absent" = current === "Present" ? "Absent" : "Present";
    const key = `member:${sessionId}:${profileId}`;
    setBusyKey(key);
    setError(null);
    try {
      await recordAttendance(sessionId, profileId, next);
      applyLocalStatus(sessionId, profileId, teamId, next);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMarkTeam(teamId: string, sessionId: string, status: "Present" | "Absent") {
    const members = membersByTeam[teamId] ?? [];
    if (members.length === 0) return;
    const key = `team:${teamId}:${sessionId}`;
    setBusyKey(key);
    setError(null);
    try {
      await Promise.all(members.map((m) => recordAttendance(sessionId, m.id, status)));
      members.forEach((m) => applyLocalStatus(sessionId, m.id, teamId, status));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
    }
  }

  function memberStatus(profileId: string, session: AttendanceSessionRow | null): Status {
    if (!session) return "Not Marked";
    const record = localAttendance.find((a) => a.session_id === session.id && a.profile_id === profileId);
    return record?.status ?? "Not Marked";
  }

  /** A team is "Present" only if every member has a Present record for that session; any explicit Absent or unmarked member (once at least one member has been touched) makes it "Absent". Zero records at all = "Not Marked". */
  function teamStatus(team: TeamRow, session: AttendanceSessionRow | null): Status {
    const members = membersByTeam[team.id] ?? [];
    if (!session || members.length === 0) return "Not Marked";
    const records = members.map((m) => localAttendance.find((a) => a.session_id === session.id && a.profile_id === m.id));
    if (records.every((r) => r?.status === "Present")) return "Present";
    if (records.some((r) => r)) return "Absent";
    return "Not Marked";
  }

  function statusClassName(status: Status) {
    return status === "Present"
      ? "border-gitam/40 bg-gitam/10 text-gitam"
      : status === "Absent"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-border text-ink-faint";
  }

  // ── Teams tab ────────────────────────────────────────────────────────

  const teamCampusOptions = useMemo(
    () => uniqueValues(teams.map((t) => (membersByTeam[t.id] ?? []).find((m) => m.is_lead)?.campus)),
    [teams, membersByTeam],
  );

  const filteredTeams = useMemo(() => {
    const q = teamFilters.search.trim().toLowerCase();
    return teams.filter((team) => {
      const members = membersByTeam[team.id] ?? [];
      const lead = members.find((m) => m.is_lead);
      const status = teamStatus(team, latestSession);

      if (q) {
        const haystack = `${team.team_name} ${lead?.name ?? ""} ${lead?.phone ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (teamFilters.campus && lead?.campus !== teamFilters.campus) return false;
      if (teamFilters.teamSize && String(teamSize(team)) !== teamFilters.teamSize) return false;
      if (teamFilters.room && team.room_id !== teamFilters.room) return false;
      if (teamFilters.spoc && team.spoc_profile_id !== teamFilters.spoc) return false;
      if (teamFilters.status && status !== teamFilters.status) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, membersByTeam, teamFilters, localAttendance, latestSession]);

  function handleExportTeams() {
    downloadCsv(
      "attendance-by-team",
      filteredTeams.flatMap((team) => {
        const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
        return localSessions.map((s) => ({
          Campus: lead?.campus ?? "—",
          "Team Name": team.team_name,
          "Team Lead": lead?.name ?? "—",
          "Lead Phone No": lead?.phone ?? "—",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          Venue: roomOf(team)?.name ?? "Unassigned",
          Session: s.name,
          "Attendance Status": teamStatus(team, s),
        }));
      }),
    );
  }

  // ── Members tab ──────────────────────────────────────────────────────

  const allMembers = useMemo(() => teams.flatMap((t) => membersByTeam[t.id] ?? []), [teams, membersByTeam]);
  const memberStayOptions = useMemo(() => uniqueValues(allMembers.map((m) => m.stay)), [allMembers]);
  const memberCampusOptions = useMemo(() => uniqueValues(allMembers.map((m) => m.campus)), [allMembers]);

  const filteredMembers = useMemo(() => {
    const q = memberFilters.search.trim().toLowerCase();
    return teams.flatMap((team) => {
      const members = membersByTeam[team.id] ?? [];
      return members
        .filter((m) => {
          if (q) {
            const haystack = `${team.team_name} ${m.name}`.toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          if (memberFilters.campus && m.campus !== memberFilters.campus) return false;
          if (memberFilters.teamSize && String(teamSize(team)) !== memberFilters.teamSize) return false;
          if (memberFilters.stay && m.stay !== memberFilters.stay) return false;
          if (memberFilters.room && team.room_id !== memberFilters.room) return false;
          if (memberFilters.spoc && team.spoc_profile_id !== memberFilters.spoc) return false;
          if (memberFilters.position && (memberFilters.position === "lead") !== m.is_lead) return false;
          for (const [sessionId, status] of Object.entries(memberFilters.sessionStatus)) {
            if (status) {
              const session = localSessions.find((s) => s.id === sessionId);
              if (session && memberStatus(m.id, session) !== status) return false;
            }
          }
          return true;
        })
        .map((member) => ({ member, team }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, membersByTeam, memberFilters, localAttendance, localSessions]);

  function handleExportMembers() {
    downloadCsv(
      "attendance-by-member",
      filteredMembers.flatMap(({ member: m, team }) =>
        localSessions.map((s) => ({
          Campus: m.campus,
          "Team ID": team.team_id,
          "Team Name": team.team_name,
          "Team Size": String(teamSize(team)),
          "User ID": m.user_id,
          Name: m.name,
          Position: m.is_lead ? "Team Lead" : "Member",
          "Reg No": m.reg_no,
          "Phone No": m.phone,
          Year: m.year_of_study,
          School: m.school,
          Branch: m.branch,
          Stay: m.stay,
          Venue: roomOf(team)?.name ?? "Unassigned",
          SPOC: spocName(team.spoc_profile_id) ?? "Unassigned",
          Session: s.name,
          Attendance: memberStatus(m.id, s),
        })),
      ),
    );
  }

  const TEAM_FIXED_COLS = 7; // chevron, Campus, Team Name, Team Lead, Lead Phone No, SPOC, Venue
  const MEMBER_FIXED_COLS = 9; // Campus, Team Name, Team Size, Member ID, Name, Position, Stay, Venue, SPOC

  return (
    <div className="flex flex-col gap-6">
      {scope === "admin" && (
        <form onSubmit={handleCreateSession} className="flex gap-3 rounded-xl border border-border bg-surface p-5">
          <input
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Session name, e.g. Session 1"
            className="flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-gold px-6 py-2 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {creating ? "Adding…" : "Add Session"}
          </button>
        </form>
      )}

      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      {localSessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="font-heading text-sm text-ink-muted">
            {scope === "admin" ? "No attendance sessions yet — add one above." : "No attendance sessions configured yet."}
          </p>
        </div>
      ) : (
        <>
          <ViewToggle
            value={view}
            onChange={setView}
            options={[
              { value: "teams", label: "View by Team" },
              { value: "members", label: "View by Participants" },
            ]}
          />

          <div ref={fadeRef}>
            {view === "teams" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      value={teamFilters.search}
                      onChange={(e) => setTeamFilters((f) => ({ ...f, search: e.target.value }))}
                      placeholder="Search by team name, team lead, or lead phone…"
                      className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
                    />
                    <button
                      type="button"
                      onClick={handleExportTeams}
                      className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                    >
                      Download All (CSV)
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FilterSelect
                      label="Campus"
                      value={teamFilters.campus}
                      onChange={(v) => setTeamFilters((f) => ({ ...f, campus: v }))}
                      options={teamCampusOptions}
                    />
                    <FilterSelect
                      label="Team Size"
                      value={teamFilters.teamSize}
                      onChange={(v) => setTeamFilters((f) => ({ ...f, teamSize: v }))}
                      options={["3", "4"]}
                    />
                    <FilterSelect
                      label="Venue"
                      value={teamFilters.room}
                      onChange={(v) => setTeamFilters((f) => ({ ...f, room: v }))}
                      options={rooms.map((r) => r.name)}
                      valueOptions={rooms.map((r) => r.id)}
                    />
                    <FilterSelect
                      label="SPOC"
                      value={teamFilters.spoc}
                      onChange={(v) => setTeamFilters((f) => ({ ...f, spoc: v }))}
                      options={spocs.map((s) => s.name)}
                      valueOptions={spocs.map((s) => s.id)}
                    />
                    <FilterSelect
                      label="Attendance Status"
                      value={teamFilters.status}
                      onChange={(v) => setTeamFilters((f) => ({ ...f, status: v }))}
                      options={["Present", "Absent", "Not Marked"]}
                    />
                  </div>
                </div>

                <p className="font-heading text-xs text-ink-muted">Showing {filteredTeams.length} teams</p>

                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full text-left font-heading text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                        <th className="px-2 py-3" />
                        <th className="px-4 py-3">Campus</th>
                        <th className="px-4 py-3">Team Name</th>
                        <th className="px-4 py-3">Team Lead</th>
                        <th className="px-4 py-3">Lead Phone No</th>
                        <th className="px-4 py-3">SPOC</th>
                        <th className="px-4 py-3">Venue</th>
                        {localSessions.map((s) => (
                          <th key={s.id} className="px-4 py-3">
                            Attendance Status ({s.name})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTeams.length === 0 ? (
                        <tr>
                          <td colSpan={TEAM_FIXED_COLS + localSessions.length} className="px-4 py-8 text-center text-ink-muted">
                            No teams match the current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredTeams.map((team) => {
                          const lead = (membersByTeam[team.id] ?? []).find((m) => m.is_lead);
                          const members = membersByTeam[team.id] ?? [];
                          const expanded = expandedTeamIds.has(team.id);
                          return (
                            <Fragment key={team.id}>
                              <tr className="border-b border-border align-top last:border-0">
                                <td className="px-2 py-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(team.id)}
                                    aria-label={expanded ? "Collapse members" : "Expand members"}
                                    className="text-ink-muted transition-colors hover:text-gold"
                                  >
                                    {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-ink-muted">{lead?.campus ?? "—"}</td>
                                <td className="px-4 py-3 text-ink">{team.team_name}</td>
                                <td className="px-4 py-3 text-ink-muted">{lead?.name ?? "—"}</td>
                                <td className="px-4 py-3 text-ink-muted">{lead?.phone ?? "—"}</td>
                                <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                                <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>
                                {localSessions.map((s) => {
                                  const status = teamStatus(team, s);
                                  const busy = busyKey === `team:${team.id}:${s.id}`;
                                  return (
                                    <td key={s.id} className="px-4 py-3">
                                      <select
                                        value={status === "Not Marked" ? "" : status}
                                        disabled={busy}
                                        onChange={(e) => handleMarkTeam(team.id, s.id, e.target.value as "Present" | "Absent")}
                                        className={`rounded-full border px-3 py-1.5 text-xs outline-none disabled:opacity-60 ${statusClassName(status)}`}
                                      >
                                        <option value="" disabled>
                                          Not Marked
                                        </option>
                                        <option value="Present">Present</option>
                                        <option value="Absent">Absent</option>
                                      </select>
                                    </td>
                                  );
                                })}
                              </tr>
                              {expanded && (
                                <tr className="border-b border-border bg-void/40">
                                  <td colSpan={TEAM_FIXED_COLS + localSessions.length} className="px-4 py-4">
                                    <div className="overflow-x-auto rounded-lg border border-border">
                                      <table className="w-full text-left font-heading text-sm">
                                        <thead>
                                          <tr className="border-b border-border text-xs text-ink-muted uppercase">
                                            <th className="px-4 py-2">Participant Name</th>
                                            <th className="px-4 py-2">Email</th>
                                            <th className="px-4 py-2">Position</th>
                                            <th className="px-4 py-2">Phone No</th>
                                            {localSessions.map((s) => (
                                              <th key={s.id} className="px-4 py-2">
                                                {s.name}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {members.map((m) => (
                                            <tr key={m.id} className="border-b border-border last:border-0">
                                              <td className="px-4 py-2 text-ink">
                                                {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                                              </td>
                                              <td className="px-4 py-2 text-ink-muted">{m.gitam_email}</td>
                                              <td className="px-4 py-2 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                                              <td className="px-4 py-2 text-ink-muted">{m.phone}</td>
                                              {localSessions.map((s) => {
                                                const mStatus = memberStatus(m.id, s);
                                                const mBusy = busyKey === `member:${s.id}:${m.id}`;
                                                return (
                                                  <td key={s.id} className="px-4 py-2">
                                                    <button
                                                      type="button"
                                                      disabled={mBusy}
                                                      onClick={() => handleToggleMember(s.id, m.id, team.id, mStatus)}
                                                      className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${statusClassName(mStatus)}`}
                                                    >
                                                      {mStatus}
                                                    </button>
                                                  </td>
                                                );
                                              })}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      value={memberFilters.search}
                      onChange={(e) => setMemberFilters((f) => ({ ...f, search: e.target.value }))}
                      placeholder="Search by team name or member name…"
                      className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
                    />
                    <button
                      type="button"
                      onClick={handleExportMembers}
                      className="rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
                    >
                      Download All (CSV)
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FilterSelect
                      label="Campus"
                      value={memberFilters.campus}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, campus: v }))}
                      options={memberCampusOptions}
                    />
                    <FilterSelect
                      label="Team Size"
                      value={memberFilters.teamSize}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, teamSize: v }))}
                      options={["3", "4"]}
                    />
                    <FilterSelect
                      label="Position"
                      value={memberFilters.position}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, position: v }))}
                      options={["Team Lead", "Member"]}
                      valueOptions={["lead", "member"]}
                    />
                    <FilterSelect
                      label="Stay"
                      value={memberFilters.stay}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, stay: v }))}
                      options={memberStayOptions}
                    />
                    <FilterSelect
                      label="Venue"
                      value={memberFilters.room}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, room: v }))}
                      options={rooms.map((r) => r.name)}
                      valueOptions={rooms.map((r) => r.id)}
                    />
                    <FilterSelect
                      label="SPOC"
                      value={memberFilters.spoc}
                      onChange={(v) => setMemberFilters((f) => ({ ...f, spoc: v }))}
                      options={spocs.map((s) => s.name)}
                      valueOptions={spocs.map((s) => s.id)}
                    />
                    {localSessions.map((s) => (
                      <FilterSelect
                        key={s.id}
                        label={s.name}
                        value={memberFilters.sessionStatus[s.id] ?? ""}
                        onChange={(v) =>
                          setMemberFilters((f) => ({
                            ...f,
                            sessionStatus: { ...f.sessionStatus, [s.id]: v },
                          }))
                        }
                        options={["Present", "Absent"]}
                      />
                    ))}
                  </div>
                </div>

                <p className="font-heading text-xs text-ink-muted">Showing {filteredMembers.length} members</p>

                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full text-left font-heading text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                        <th className="px-4 py-3">Campus</th>
                        <th className="px-4 py-3">Team Name</th>
                        <th className="px-4 py-3">Team Size</th>
                        <th className="px-4 py-3">User ID</th>
                        <th className="px-4 py-3">Participant Name</th>
                        <th className="px-4 py-3">Position</th>
                        <th className="px-4 py-3">Stay</th>
                        <th className="px-4 py-3">Venue</th>
                        <th className="px-4 py-3">SPOC</th>
                        {localSessions.map((s) => (
                          <th key={s.id} className="px-4 py-3">
                            {s.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={MEMBER_FIXED_COLS + localSessions.length} className="px-4 py-8 text-center text-ink-muted">
                            No members match the current filters.
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map(({ member: m, team }) => (
                          <tr key={m.id} className="border-b border-border align-top last:border-0">
                            <td className="px-4 py-3 text-ink-muted">{m.campus}</td>
                            <td className="px-4 py-3 text-ink-muted">{team.team_name}</td>
                            <td className="px-4 py-3 text-ink-muted">{teamSize(team)}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.user_id}</td>
                            <td className="px-4 py-3 text-ink">{m.name}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                            <td className="px-4 py-3 text-ink-muted">{m.stay}</td>
                            <td className="px-4 py-3 text-ink-muted">{roomOf(team)?.name ?? "Unassigned"}</td>
                            <td className="px-4 py-3 text-ink-muted">{spocName(team.spoc_profile_id) ?? "Unassigned"}</td>
                            {localSessions.map((s) => {
                              const status = memberStatus(m.id, s);
                              const busy = busyKey === `member:${s.id}:${m.id}`;
                              return (
                                <td key={s.id} className="px-4 py-3">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleToggleMember(s.id, m.id, team.id, status)}
                                    className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${statusClassName(status)}`}
                                  >
                                    {status}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
