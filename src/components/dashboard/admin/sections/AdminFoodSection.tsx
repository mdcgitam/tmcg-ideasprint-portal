"use client";

import { useState } from "react";
import type { FoodCouponRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { recordFoodRedemption, DashboardActionError } from "@/lib/dashboard/admin-actions";

export function AdminFoodSection({
  teams,
  membersByTeam,
  foodCoupons,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  foodCoupons: FoodCouponRow[];
}) {
  const [local, setLocal] = useState(foodCoupons);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allMembers = teams.flatMap((t) => membersByTeam[t.id] ?? []);

  async function handleToggle(profileId: string, meal: "lunch" | "dinner", current: "Redeemed" | "Not Redeemed") {
    const next = current === "Redeemed" ? "Not Redeemed" : "Redeemed";
    const key = `${profileId}:${meal}`;
    setBusyKey(key);
    setError(null);
    try {
      await recordFoodRedemption(profileId, meal, next);
      setLocal((prev) => {
        const existing = prev.find((f) => f.profile_id === profileId);
        if (existing) {
          return prev.map((f) => (f.profile_id === profileId ? { ...f, [`${meal}_status`]: next } : f));
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            profile_id: profileId,
            lunch_status: meal === "lunch" ? next : "Not Redeemed",
            lunch_recorded_by: null,
            lunch_recorded_at: null,
            dinner_status: meal === "dinner" ? next : "Not Redeemed",
            dinner_recorded_by: null,
            dinner_recorded_at: null,
          },
        ];
      });
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      {error && <p className="p-4 font-heading text-sm text-danger">{error}</p>}
      <table className="w-full text-left font-heading text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted uppercase">
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Lunch</th>
            <th className="px-4 py-3">Dinner</th>
          </tr>
        </thead>
        <tbody>
          {allMembers.map((m) => {
            const coupon = local.find((f) => f.profile_id === m.id);
            return (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink">{m.name}</td>
                {(["lunch", "dinner"] as const).map((meal) => {
                  const status = meal === "lunch" ? (coupon?.lunch_status ?? "Not Redeemed") : (coupon?.dinner_status ?? "Not Redeemed");
                  const key = `${m.id}:${meal}`;
                  return (
                    <td key={meal} className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busyKey === key}
                        onClick={() => handleToggle(m.id, meal, status)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${
                          status === "Redeemed" ? "border-gitam/40 bg-gitam/10 text-gitam" : "border-border text-ink-faint"
                        }`}
                      >
                        {status}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
