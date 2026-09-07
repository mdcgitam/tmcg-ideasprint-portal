"use client";

import { useState } from "react";
import type { ExitRequestRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { resolveMemberExit, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { getSignedUrl } from "@/lib/dashboard/team-actions";

/**
 * Exit form submissions — split out from Approvals so a reviewer sees only
 * exit requests here (team-edit requests stay in Approvals). Same
 * approve/reject flow as before, just its own module.
 */
export function ExitSubmissionsSection({
  exitRequests,
  teams,
  membersByTeam,
  rooms,
  zones,
  staffAccounts,
}: {
  exitRequests: ExitRequestRow[];
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
}) {
  const [localExitRequests, setLocalExitRequests] = useState(exitRequests.filter((r) => r.status === "Requested"));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leadOf = (team: TeamRow | undefined) => (team ? (membersByTeam[team.id] ?? []).find((m) => m.is_lead) : null) ?? null;
  const campusOf = (team: TeamRow | undefined) => leadOf(team)?.campus ?? team?.campus ?? "—";
  const roomOf = (team: TeamRow | undefined) => (team?.room_id ? (rooms.find((r) => r.id === team.room_id) ?? null) : null);
  const zoneOf = (team: TeamRow | undefined) => {
    const room = roomOf(team);
    return room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null;
  };
  const spocName = (team: TeamRow | undefined) =>
    team?.spoc_profile_id ? (staffAccounts.find((s) => s.id === team.spoc_profile_id)?.name ?? null) : null;

  async function handleResolveExit(requestId: string, decision: "Approved" | "Rejected") {
    setBusyId(requestId);
    setError(null);
    try {
      await resolveMemberExit(requestId, decision);
      setLocalExitRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewExitFile(filePath: string) {
    const url = await getSignedUrl("exit-requests", filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (localExitRequests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No pending exit form submissions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="font-heading text-sm text-danger">{error}</p>}

      {localExitRequests.map((req) => {
        const team = teams.find((t) => t.id === req.team_id);
        const member = (membersByTeam[req.team_id] ?? []).find((m) => m.id === req.profile_id);
        return (
          <div key={req.id} className="rounded-xl border border-danger/40 bg-danger/5 p-6">
            <div className="flex flex-col gap-1">
              <p className="font-heading text-sm text-gold">{team?.team_name ?? "Unknown team"}</p>
              <p className="font-heading text-xs text-ink-muted">
                Campus: {campusOf(team)} · Zone: {zoneOf(team)?.name ?? "Unassigned"} · Venue:{" "}
                {roomOf(team)?.name ?? "Unassigned"} · SPOC: {spocName(team) ?? "Unassigned"} · Team Lead:{" "}
                {leadOf(team)?.name ?? "—"}
              </p>
            </div>
            <p className="mt-2 font-heading text-xs text-ink-muted">Exit request received · {member?.name ?? "Unknown member"}</p>
            {req.reason && <p className="mt-1 font-heading text-xs text-ink-muted">Reason: {req.reason}</p>}
            {req.file_path && (
              <button
                type="button"
                onClick={() => handleViewExitFile(req.file_path!)}
                className="mt-2 font-heading text-sm text-gold underline"
              >
                View Exit Form
              </button>
            )}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={busyId === req.id}
                onClick={() => handleResolveExit(req.id, "Approved")}
                className="rounded-full bg-gitam px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:opacity-90 disabled:opacity-60"
              >
                Approve Exit
              </button>
              <button
                type="button"
                disabled={busyId === req.id}
                onClick={() => handleResolveExit(req.id, "Rejected")}
                className="rounded-full border border-danger/40 px-6 py-2.5 font-heading text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
