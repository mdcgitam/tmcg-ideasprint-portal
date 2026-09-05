import type { AttendanceRow, AttendanceSessionRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";

/** Read-only for both roles (SPEC §27-28) — recording is SPOC/Super Admin only, Phase 6. */
export function AttendanceSection({
  members,
  attendance,
  attendanceSessions,
  spocName,
}: {
  members: TeamMemberProfile[];
  attendance: AttendanceRow[];
  attendanceSessions: AttendanceSessionRow[];
  spocName: string | null;
}) {
  if (attendanceSessions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No attendance sessions have been configured yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-heading text-xs text-ink-muted">Assigned SPOC: {spocName ?? "Not yet assigned"}</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left font-heading text-sm">
        <thead>
          <tr className="border-b border-border bg-gold text-xs text-void uppercase">
            <th className="px-4 py-3">Member</th>
            {attendanceSessions.map((s) => (
              <th key={s.id} className="px-4 py-3">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-ink">
                {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
              </td>
              {attendanceSessions.map((s) => {
                const record = attendance.find((a) => a.profile_id === m.id && a.session_id === s.id);
                return (
                  <td key={s.id} className="px-4 py-3">
                    {record ? (
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${
                          record.status === "Present"
                            ? "border-gitam/40 bg-gitam/10 text-gitam"
                            : "border-danger/40 bg-danger/10 text-danger"
                        }`}
                      >
                        {record.status}
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
