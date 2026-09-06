"use client";

import { useState } from "react";
import type { TeamRow, ApprovalRequestRow, NocRow, ExitRequestRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "aggregate" | "by-team";

/** Dashboard metrics (SPEC §76). Food is dropped as a feature (ideasprint_changes.pdf item 14) — no redemption metrics here. "Today's Attendance" is intentionally omitted — no session has a meaningful "today" concept without real event dates configured yet; per-session detail lives on the Attendance page instead. */
export function OverviewSection({
  scope,
  teams,
  membersByTeam,
  pendingApprovals,
  nocs,
  exitRequests,
}: {
  scope: "spoc" | "admin";
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  pendingApprovals: ApprovalRequestRow[];
  nocs: NocRow[];
  exitRequests: ExitRequestRow[];
}) {
  const [view, setView] = useState<View>("aggregate");
  const fadeRef = useTabFade(view);
  const allMembers = Object.values(membersByTeam).flat();

  function isExited(profileId: string) {
    return exitRequests.find((r) => r.profile_id === profileId)?.status === "Approved";
  }

  const totalParticipants = allMembers.length;
  const totalActiveMembers = allMembers.filter((m) => !isExited(m.id)).length;
  const missingNocs = allMembers.filter(
    (m) => nocs.find((n) => n.profile_id === m.id)?.status !== "Uploaded",
  ).length;
  const pendingExits = exitRequests.filter((r) => r.status === "Requested").length;
  const unassignedRoom = teams.filter((t) => !t.room_id).length;

  const cards = [
    { label: scope === "admin" ? "Total Teams" : "Assigned Teams", value: String(teams.length) },
    { label: scope === "admin" ? "Total Registrations" : "Team Members", value: String(totalParticipants) },
    { label: "Total Members", value: String(totalActiveMembers) },
    { label: "Pending Approvals", value: String(pendingApprovals.length) },
    { label: "Missing NOCs", value: String(missingNocs) },
    { label: "Pending Exit Requests", value: String(pendingExits) },
    { label: "Teams Unassigned To A Room", value: String(unassignedRoom) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "aggregate", label: "Summary" },
          { value: "by-team", label: "View by Team" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "aggregate" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-surface p-6">
                <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{c.label}</span>
                <p className="mt-3 font-display text-3xl text-ink">{c.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left font-heading text-sm">
              <thead>
                <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Missing NOCs</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Room Assigned</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const members = membersByTeam[team.id] ?? [];
                  const teamMissingNocs = members.filter(
                    (m) => nocs.find((n) => n.profile_id === m.id)?.status !== "Uploaded",
                  ).length;
                  const exitedCount = members.filter((m) => isExited(m.id)).length;
                  return (
                    <tr key={team.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-ink">
                        {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{members.length}</td>
                      <td className="px-4 py-3 text-ink-muted">{teamMissingNocs}</td>
                      <td className="px-4 py-3 text-ink-muted">{exitedCount > 0 ? `${exitedCount} Exited` : "Active"}</td>
                      <td className="px-4 py-3 text-ink-muted">{team.room_id ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
