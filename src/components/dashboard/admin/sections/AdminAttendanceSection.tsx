"use client";

import { Fragment, useMemo, useState } from "react";
import type { AttendanceRow, AttendanceSessionRow, ProfileRow, RoomRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { recordAttendance, createAttendanceSession, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { FilterSelect } from "@/components/dashboard/admin/sections/TeamFormFields";
import { useTabFade } from "@/hooks/useTabFade";

type View = "all-members" | "by-team";

/** SPOC marks attendance for their own room; Super Admin can only view it (with the SPOC assigned to each team visible). */
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
  const [view, setView] = useState<View>("all-members");
  const [venueFilter, setVenueFilter] = useState("");
  const [spocFilter, setSpocFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const fadeRef = useTabFade(view);

  const canMark = scope === "spoc";

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

  async function handleToggle(sessionId: string, profileId: string, current: "Present" | "Absent" | null) {
    const next = current === "Present" ? "Absent" : "Present";
    const key = `${sessionId}:${profileId}`;
    setBusyKey(key);
    setError(null);
    try {
      await recordAttendance(sessionId, profileId, next);
      setLocalAttendance((prev) => {
        const existing = prev.find((a) => a.session_id === sessionId && a.profile_id === profileId);
        if (existing) {
          return prev.map((a) => (a === existing ? { ...a, status: next } : a));
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            session_id: sessionId,
            profile_id: profileId,
            team_id: "",
            status: next,
            recorded_by: "",
            recorded_at: new Date().toISOString(),
          },
        ];
      });
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
      setLocalAttendance((prev) => {
        const memberIds = new Set(members.map((m) => m.id));
        const untouched = prev.filter((a) => !(a.session_id === sessionId && memberIds.has(a.profile_id)));
        const updated = members.map((m) => {
          const existing = prev.find((a) => a.session_id === sessionId && a.profile_id === m.id);
          return {
            id: existing?.id ?? crypto.randomUUID(),
            session_id: sessionId,
            profile_id: m.id,
            team_id: teamId,
            status,
            recorded_by: existing?.recorded_by ?? "",
            recorded_at: new Date().toISOString(),
          };
        });
        return [...untouched, ...updated];
      });
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
    }
  }

  const allMembers = teams.flatMap((t) => membersByTeam[t.id] ?? []);
  const teamNameByProfileId: Record<string, string> = {};
  const spocByProfileId: Record<string, string> = {};
  const venueByProfileId: Record<string, string> = {};
  for (const t of teams) {
    const spoc = staffAccounts.find((s) => s.id === t.spoc_profile_id)?.name ?? "Unassigned";
    const venue = rooms.find((r) => r.id === t.room_id)?.name ?? "Unassigned";
    for (const m of membersByTeam[t.id] ?? []) {
      teamNameByProfileId[m.id] = t.team_name;
      spocByProfileId[m.id] = spoc;
      venueByProfileId[m.id] = venue;
    }
  }

  const filteredTeams = useMemo(
    () =>
      teams.filter(
        (t) => (!venueFilter || t.room_id === venueFilter) && (!spocFilter || t.spoc_profile_id === spocFilter),
      ),
    [teams, venueFilter, spocFilter],
  );
  function matchesPosition(m: TeamMemberProfile) {
    if (!positionFilter) return true;
    return positionFilter === "lead" ? m.is_lead : !m.is_lead;
  }

  const filteredMembers = useMemo(() => {
    const ids = new Set(filteredTeams.flatMap((t) => (membersByTeam[t.id] ?? []).map((m) => m.id)));
    return allMembers.filter((m) => ids.has(m.id) && matchesPosition(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeams, membersByTeam, positionFilter]);

  function handleExportSession(session: AttendanceSessionRow) {
    downloadCsv(
      `attendance-${session.name}`,
      filteredMembers.map((m) => ({
        "User ID": m.user_id,
        Name: m.name,
        Team: teamNameByProfileId[m.id] ?? "—",
        Position: m.is_lead ? "Team Lead" : "Member",
        SPOC: spocByProfileId[m.id] ?? "Unassigned",
        Venue: venueByProfileId[m.id] ?? "Unassigned",
        Status: localAttendance.find((a) => a.session_id === session.id && a.profile_id === m.id)?.status ?? "Not Marked",
      })),
    );
  }

  function handleExportAll() {
    downloadCsv(
      "attendance-all-sessions",
      filteredMembers.flatMap((m) =>
        localSessions.map((s) => ({
          Team: teamNameByProfileId[m.id] ?? "—",
          Member: m.name,
          Position: m.is_lead ? "Team Lead" : "Member",
          SPOC: spocByProfileId[m.id] ?? "Unassigned",
          Venue: venueByProfileId[m.id] ?? "Unassigned",
          Session: s.name,
          Status: localAttendance.find((a) => a.session_id === s.id && a.profile_id === m.id)?.status ?? "Not Marked",
        })),
      ),
    );
  }

  function statusCell(m: TeamMemberProfile, s: AttendanceSessionRow) {
    const record = localAttendance.find((a) => a.session_id === s.id && a.profile_id === m.id);
    const status = record?.status ?? null;
    const key = `${s.id}:${m.id}`;
    const className = `rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${
      status === "Present"
        ? "border-gitam/40 bg-gitam/10 text-gitam"
        : status === "Absent"
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-border text-ink-faint"
    }`;

    if (!canMark) {
      return <span className={`inline-block ${className}`}>{status ?? "Not Marked"}</span>;
    }
    return (
      <button
        type="button"
        disabled={busyKey === key}
        onClick={() => handleToggle(s.id, m.id, status)}
        className={className}
      >
        {status ?? "Not Marked"}
      </button>
    );
  }

  const sessionHeaderCells = (
    <>
      {localSessions.map((s) => (
        <th key={s.id} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span>{s.name}</span>
            <button
              type="button"
              onClick={() => handleExportSession(s)}
              className="rounded-full border border-gold/50 px-2 py-0.5 text-[10px] font-medium text-gold normal-case transition-colors hover:bg-gold/10"
            >
              Export CSV
            </button>
          </div>
        </th>
      ))}
    </>
  );

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

      {!canMark && (
        <p className="font-heading text-xs text-ink-muted">
          View only — the assigned SPOC marks attendance for each team.
        </p>
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
              { value: "all-members", label: "View by Member" },
              { value: "by-team", label: "View by Session" },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-4">
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
              options={spocs.map((s) => s.name)}
              valueOptions={spocs.map((s) => s.id)}
            />
            <FilterSelect
              label="Position"
              value={positionFilter}
              onChange={setPositionFilter}
              options={["Team Lead", "Member"]}
              valueOptions={["lead", "member"]}
            />
            <button
              type="button"
              onClick={handleExportAll}
              className="ml-auto rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
            >
              Download All (CSV)
            </button>
          </div>

          <div ref={fadeRef} className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left font-heading text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-ink-muted uppercase">
                  <th className="px-4 py-3">Team Name</th>
                  <th className="px-4 py-3">Member Name</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">SPOC</th>
                  <th className="px-4 py-3">Venue</th>
                  {sessionHeaderCells}
                </tr>
              </thead>
              <tbody>
                {view === "all-members"
                  ? filteredMembers.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-ink-muted">{teamNameByProfileId[m.id] ?? "—"}</td>
                        <td className="px-4 py-3 text-ink">{m.name}</td>
                        <td className="px-4 py-3 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                        <td className="px-4 py-3 text-ink-muted">{spocByProfileId[m.id] ?? "Unassigned"}</td>
                        <td className="px-4 py-3 text-ink-muted">{venueByProfileId[m.id] ?? "Unassigned"}</td>
                        {localSessions.map((s) => (
                          <td key={s.id} className="px-4 py-3">
                            {statusCell(m, s)}
                          </td>
                        ))}
                      </tr>
                    ))
                  : filteredTeams.map((team) => {
                      const members = (membersByTeam[team.id] ?? []).filter(matchesPosition);
                      if (members.length === 0) return null;
                      return (
                        <Fragment key={team.id}>
                          <tr className="border-b border-border bg-void/40">
                            <td colSpan={5} className="px-4 py-2 font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">
                              {team.team_name}
                            </td>
                            {localSessions.map((s) => {
                              const busy = busyKey === `team:${team.id}:${s.id}`;
                              return (
                                <td key={s.id} className="px-4 py-2">
                                  {canMark ? (
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => handleMarkTeam(team.id, s.id, "Present")}
                                        className="rounded-full border border-gitam/40 px-2 py-0.5 text-[10px] font-medium text-gitam normal-case transition-colors hover:bg-gitam/10 disabled:opacity-60"
                                      >
                                        All Present
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => handleMarkTeam(team.id, s.id, "Absent")}
                                        className="rounded-full border border-danger/40 px-2 py-0.5 text-[10px] font-medium text-danger normal-case transition-colors hover:bg-danger/10 disabled:opacity-60"
                                      >
                                        All Absent
                                      </button>
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                          {members.map((m) => (
                            <tr key={m.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-3 text-ink-muted">{team.team_name}</td>
                              <td className="px-4 py-3 text-ink">{m.name}</td>
                              <td className="px-4 py-3 text-ink-muted">{m.is_lead ? "Team Lead" : "Member"}</td>
                              <td className="px-4 py-3 text-ink-muted">{spocByProfileId[m.id] ?? "Unassigned"}</td>
                              <td className="px-4 py-3 text-ink-muted">{venueByProfileId[m.id] ?? "Unassigned"}</td>
                              {localSessions.map((s) => (
                                <td key={s.id} className="px-4 py-3">
                                  {statusCell(m, s)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
