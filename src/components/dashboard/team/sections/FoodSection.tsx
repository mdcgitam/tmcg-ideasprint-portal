import type { FoodCouponRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";

function StatusBadge({ status }: { status: "Redeemed" | "Not Redeemed" }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        status === "Redeemed" ? "border-gitam/40 bg-gitam/10 text-gitam" : "border-border text-ink-faint"
      }`}
    >
      {status}
    </span>
  );
}

/** Read-only for both roles — recording is SPOC/Super Admin only, Phase 6. Breakfast is never tracked (SPEC §57-62). */
export function FoodSection({ members, foodCoupons }: { members: TeamMemberProfile[]; foodCoupons: FoodCouponRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left font-heading text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted uppercase">
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Lunch</th>
            <th className="px-4 py-3">Dinner</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const coupon = foodCoupons.find((f) => f.profile_id === m.id);
            return (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink">
                  {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={coupon?.lunch_status ?? "Not Redeemed"} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={coupon?.dinner_status ?? "Not Redeemed"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
