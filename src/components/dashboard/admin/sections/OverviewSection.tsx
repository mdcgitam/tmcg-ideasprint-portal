import type { TeamRow, ApprovalRequestRow, NocRow, ExitFormRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";

/** Dashboard metrics (SPEC §76). Food is dropped as a feature (ideasprint_changes.pdf item 14) — no redemption metrics here. "Today's Attendance" is intentionally omitted — no session has a meaningful "today" concept without real event dates configured yet; per-session detail lives on the Attendance tab instead. */
export function OverviewSection({
  scope,
  teams,
  allMembers,
  pendingApprovals,
  nocs,
  exitForms,
}: {
  scope: "spoc" | "admin";
  teams: TeamRow[];
  allMembers: TeamMemberProfile[];
  pendingApprovals: ApprovalRequestRow[];
  nocs: NocRow[];
  exitForms: ExitFormRow[];
}) {
  const totalParticipants = allMembers.length;
  const missingNocs = allMembers.filter(
    (m) => nocs.find((n) => n.profile_id === m.id)?.status !== "Uploaded",
  ).length;
  const exitSubmitted = exitForms.filter((e) => e.status === "Submitted").length;
  const unassignedRoom = teams.filter((t) => !t.room_id).length;

  const cards = [
    { label: scope === "admin" ? "Total Teams" : "Assigned Teams", value: String(teams.length) },
    { label: scope === "admin" ? "Total Registrations" : "Team Members", value: String(totalParticipants) },
    { label: "Pending Approvals", value: String(pendingApprovals.length) },
    { label: "Missing NOCs", value: String(missingNocs) },
    { label: "Exit Forms Pending", value: `${teams.length - exitSubmitted}/${teams.length}` },
    { label: "Teams Unassigned To A Room", value: String(unassignedRoom) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{c.label}</span>
          <p className="mt-3 font-display text-3xl text-ink">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
