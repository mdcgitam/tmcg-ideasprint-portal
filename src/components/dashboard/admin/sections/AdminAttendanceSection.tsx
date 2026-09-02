"use client";

import { useState } from "react";
import type { AttendanceRow, AttendanceSessionRow, ProfileRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { recordAttendance, createAttendanceSession, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";

export function AdminAttendanceSection({
  teams,
  membersByTeam,
  attendanceSessions,
  attendance,
  scope,
  staffAccounts,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  attendanceSessions: AttendanceSessionRow[];
  attendance: AttendanceRow[];
  scope: "spoc" | "admin";
  staffAccounts: ProfileRow[];
}) {
  const [localSessions, setLocalSessions] = useState(attendanceSessions);
  const [localAttendance, setLocalAttendance] = useState(attendance);
  const [sessionName, setSessionName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const allMembers = teams.flatMap((t) => membersByTeam[t.id] ?? []);
  const teamNameByProfileId: Record<string, string> = {};
  const spocByProfileId: Record<string, string> = {};
  for (const t of teams) {
    const spoc = staffAccounts.find((s) => s.id === t.spoc_profile_id)?.name ?? "Unassigned";
    for (const m of membersByTeam[t.id] ?? []) {
      teamNameByProfileId[m.id] = t.team_name;
      spocByProfileId[m.id] = spoc;
    }
  }

  function handleExportSession(session: AttendanceSessionRow) {
    downloadCsv(
      `attendance-${session.name}`,
      allMembers.map((m) => ({
        "User ID": m.user_id,
        Name: m.name,
        Team: teamNameByProfileId[m.id] ?? "—",
        SPOC: spocByProfileId[m.id] ?? "Unassigned",
        Status: localAttendance.find((a) => a.session_id === session.id && a.profile_id === m.id)?.status ?? "Not Marked",
      })),
    );
  }

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
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left font-heading text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted uppercase">
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">SPOC</th>
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
              </tr>
            </thead>
            <tbody>
              {allMembers.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-ink">{m.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{teamNameByProfileId[m.id] ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{spocByProfileId[m.id] ?? "Unassigned"}</td>
                  {localSessions.map((s) => {
                    const record = localAttendance.find((a) => a.session_id === s.id && a.profile_id === m.id);
                    const status = record?.status ?? null;
                    const key = `${s.id}:${m.id}`;
                    return (
                      <td key={s.id} className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busyKey === key}
                          onClick={() => handleToggle(s.id, m.id, status)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${
                            status === "Present"
                              ? "border-gitam/40 bg-gitam/10 text-gitam"
                              : status === "Absent"
                                ? "border-danger/40 bg-danger/10 text-danger"
                                : "border-border text-ink-faint"
                          }`}
                        >
                          {status ?? "Not Marked"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
