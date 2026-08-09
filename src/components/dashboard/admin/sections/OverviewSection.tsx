import type { TeamRow, ApprovalRequestRow, NocRow, ExitFormRow, FoodCouponRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";

/** SPEC §76 dashboard metrics. "Today's Attendance" is intentionally omitted — no session has a meaningful "today" concept without real event dates configured yet; per-session detail lives on the Attendance tab instead. */
export function OverviewSection({
  scope,
  teams,
  allMembers,
  pendingApprovals,
  nocs,
  exitForms,
  foodCoupons,
}: {
  scope: "spoc" | "admin";
  teams: TeamRow[];
  allMembers: TeamMemberProfile[];
  pendingApprovals: ApprovalRequestRow[];
  nocs: NocRow[];
  exitForms: ExitFormRow[];
  foodCoupons: FoodCouponRow[];
}) {
  const totalParticipants = allMembers.length;
  const missingNocs = allMembers.filter(
    (m) => nocs.find((n) => n.profile_id === m.id)?.status !== "Uploaded",
  ).length;
  const exitSubmitted = exitForms.filter((e) => e.status === "Submitted").length;
  const lunchRedeemed = foodCoupons.filter((f) => f.lunch_status === "Redeemed").length;
  const dinnerRedeemed = foodCoupons.filter((f) => f.dinner_status === "Redeemed").length;

  const cards = [
    { label: scope === "admin" ? "Total Teams" : "Assigned Teams", value: String(teams.length) },
    { label: scope === "admin" ? "Total Registrations" : "Team Members", value: String(totalParticipants) },
    { label: "Pending Approvals", value: String(pendingApprovals.length) },
    { label: "Missing NOCs", value: String(missingNocs) },
    { label: "Exit Forms Pending", value: `${teams.length - exitSubmitted}/${teams.length}` },
    { label: "Lunch Redeemed", value: `${lunchRedeemed}/${totalParticipants}` },
    { label: "Dinner Redeemed", value: `${dinnerRedeemed}/${totalParticipants}` },
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
