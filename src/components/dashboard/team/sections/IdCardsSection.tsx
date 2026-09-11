import type { IdCardCertRecordRow, ProfileRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";

/**
 * Read-only — recording a status is SPOC/Zone Manager/Campus Admin/Super
 * Admin only (record_id_card_certificate, 0044). A Team Lead sees every
 * member's status; a Member sees only their own. Same table shape as
 * AttendanceSection.
 */
export function IdCardsSection({
  profile,
  members,
  records,
  isLead,
}: {
  profile: ProfileRow;
  members: TeamMemberProfile[];
  records: IdCardCertRecordRow[];
  isLead: boolean;
}) {
  const visibleMembers = isLead ? members : members.filter((m) => m.id === profile.id);

  function statusFor(profileId: string, item: "ID Card" | "Certificate") {
    return records.find((r) => r.profile_id === profileId && r.item === item)?.status ?? "Pending";
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left font-heading text-sm">
        <thead>
          <tr className="border-b border-border bg-gold text-xs text-void uppercase">
            <th className="px-4 py-3">Participant Name</th>
            <th className="px-4 py-3">ID Card</th>
            <th className="px-4 py-3">Certificate</th>
          </tr>
        </thead>
        <tbody>
          {visibleMembers.map((m) => {
            const idCard = statusFor(m.id, "ID Card");
            const certificate = statusFor(m.id, "Certificate");
            return (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink">
                  {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={idCard} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={certificate} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: "Completed" | "Pending" }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        status === "Completed" ? "border-gitam/40 bg-gitam/10 text-gitam" : "border-border text-ink-muted"
      }`}
    >
      {status}
    </span>
  );
}
