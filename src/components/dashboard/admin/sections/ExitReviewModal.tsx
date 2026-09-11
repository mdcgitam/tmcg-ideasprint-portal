"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ExitRequestRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { resolveMemberExit, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { getSignedUrl } from "@/lib/dashboard/team-actions";
import { canApproveExit } from "@/lib/dashboard/exit-eligibility";

/** "View" popup from the Teams table — every member's exit status, Approve/Reject each. */
export function ExitReviewModal({
  team,
  members,
  exitRequests,
  rooms,
  zones,
  staffAccounts,
  onRequestsChanged,
  onClose,
}: {
  team: TeamRow;
  members: TeamMemberProfile[];
  exitRequests: ExitRequestRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  onRequestsChanged: (updated: ExitRequestRow[]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, []);

  const [localRequests, setLocalRequests] = useState(exitRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const room = team.room_id ? (rooms.find((r) => r.id === team.room_id) ?? null) : null;
  const zone = room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null;
  const zoneManagerName = zone?.zone_manager_profile_id ? (staffAccounts.find((s) => s.id === zone.zone_manager_profile_id)?.name ?? null) : null;
  const spocName = team.spoc_profile_id ? (staffAccounts.find((s) => s.id === team.spoc_profile_id)?.name ?? null) : null;

  const activeMembers = members.filter((m) => m.is_active);
  const activeMemberIds = activeMembers.map((m) => m.id);

  function currentRequestFor(profileId: string): ExitRequestRow | null {
    return (
      localRequests
        .filter((r) => r.profile_id === profileId)
        .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())[0] ?? null
    );
  }

  const currentStatusByProfileId = Object.fromEntries(members.map((m) => [m.id, currentRequestFor(m.id)?.status]));

  async function handleResolve(requestId: string, decision: "Approved" | "Rejected") {
    setBusyId(requestId);
    setError(null);
    try {
      await resolveMemberExit(requestId, decision);
      const updated = localRequests.map((r) => (r.id === requestId ? { ...r, status: decision, reviewed_at: new Date().toISOString() } : r));
      setLocalRequests(updated);
      onRequestsChanged(updated);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleView(filePath: string) {
    const url = await getSignedUrl("exit-requests", filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="font-display text-2xl text-ink">{team.team_name}</h2>
            <p className="mt-1 font-heading text-xs text-ink-muted">
              {team.team_id} · Campus: {team.campus} · Zone: {zone?.name ?? "Unassigned"} · Zone Manager:{" "}
              {zoneManagerName ?? "Unassigned"} · Venue: {room?.name ?? "Unassigned"} · SPOC: {spocName ?? "Unassigned"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <p className="mb-3 font-heading text-sm text-danger">{error}</p>}
          <div className="flex flex-col gap-2">
            {members.map((m) => {
              const req = currentRequestFor(m.id);
              const busy = req ? busyId === req.id : false;
              const eligible = m.is_active && canApproveExit(m.id, activeMemberIds, currentStatusByProfileId);
              return (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-void/40 px-4 py-3 ${m.is_active ? "" : "opacity-60"}`}
                >
                  <div>
                    <p className="font-heading text-sm text-ink">
                      {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                      {!m.is_active && <span className="ml-1 text-xs text-danger">(Inactive)</span>}
                    </p>
                    <p
                      className={`mt-0.5 font-heading text-xs ${
                        req?.status === "Approved" ? "text-danger" : req?.status === "Requested" ? "text-gold" : "text-ink-faint"
                      }`}
                    >
                      {req?.status ?? "No Request"}
                      {req?.reason && ` · ${req.reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {req?.file_path && (
                      <button type="button" onClick={() => handleView(req.file_path!)} className="font-heading text-xs text-gold underline">
                        View Form
                      </button>
                    )}
                    {req?.status === "Requested" && (
                      <>
                        <button
                          type="button"
                          disabled={busy || !eligible}
                          title={!eligible ? "This team is at the 3-member minimum — every other active member must also be exiting first." : undefined}
                          onClick={() => handleResolve(req.id, "Approved")}
                          className="rounded-full bg-gitam px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:opacity-90 disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleResolve(req.id, "Rejected")}
                          className="rounded-full border border-danger/40 px-4 py-1.5 font-heading text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
