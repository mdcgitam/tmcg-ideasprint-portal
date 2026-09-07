"use client";

import { useState } from "react";
import type { TeamRow, ApprovalRequestRow, NocRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { activeMemberCount, teamActiveStatus } from "@/components/dashboard/admin/sections/ExitStatusBadge";
import { useTabFade } from "@/hooks/useTabFade";

type View = "aggregate" | "by-team";

/** Dashboard metrics (SPEC §76). Food is dropped as a feature (ideasprint_changes.pdf item 14) — no redemption metrics here. "Today's Attendance" is intentionally omitted — no session has a meaningful "today" concept without real event dates configured yet; per-session detail lives on the Attendance page instead. */
export function OverviewSection({
  scope,
  teams,
  membersByTeam,
  pendingApprovals,
  nocs,
}: {
  scope: "spoc" | "admin";
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  pendingApprovals: ApprovalRequestRow[];
  nocs: NocRow[];
}) {
  const [view, setView] = useState<View>("aggregate");
  const fadeRef = useTabFade(view);
  const allMembers = Object.values(membersByTeam).flat();

  const totalParticipants = allMembers.length;
  // Missing NOCs counts only active members — an exited member's missing NOC isn't the team's problem anymore.
  const missingNocs = allMembers.filter(
    (m) => m.is_active && nocs.find((n) => n.profile_id === m.id)?.status !== "Uploaded",
  ).length;
  const maleCount = allMembers.filter((m) => m.gender === "Male").length;
  const femaleCount = allMembers.filter((m) => m.gender === "Female").length;
  const gscseCount = allMembers.filter((m) => m.school === "GSCSE").length;
  const gsceCount = allMembers.filter((m) => m.school === "GSCE").length;

  const cards = [
    { label: scope === "admin" ? "Total Teams" : "Assigned Teams", value: String(teams.length) },
    { label: "Total Participants", value: String(totalParticipants) },
    { label: "Missing NOCs", value: String(missingNocs) },
    { label: "No. of Male", value: String(maleCount) },
    { label: "No. of Female", value: String(femaleCount) },
    { label: "Pending Approvals", value: String(pendingApprovals.length) },
    { label: "No. of Students — GSCSE", value: String(gscseCount) },
    { label: "No. of Students — GSCE", value: String(gsceCount) },
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
                  <th className="px-4 py-3">Venue Assigned</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const members = membersByTeam[team.id] ?? [];
                  const teamMissingNocs = members.filter(
                    (m) => m.is_active && nocs.find((n) => n.profile_id === m.id)?.status !== "Uploaded",
                  ).length;
                  const inactiveCount = members.filter((m) => !m.is_active).length;
                  const teamStatusLabel = teamActiveStatus(members);
                  return (
                    <tr key={team.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-ink">{team.team_name}</td>
                      <td className="px-4 py-3 text-ink-muted">{activeMemberCount(members) || members.length}</td>
                      <td className="px-4 py-3 text-ink-muted">{teamMissingNocs}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {teamStatusLabel}
                        {teamStatusLabel === "Active" && inactiveCount > 0 && ` · ${inactiveCount} inactive`}
                      </td>
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
