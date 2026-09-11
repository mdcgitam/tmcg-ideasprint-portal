import type { IdCardCertRecordRow, ProfileRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";

/**
 * Read-only — recording a status is SPOC/Zone Manager/Campus Admin/Super
 * Admin only (record_id_card_certificate, 0044). A Team Lead sees every
 * member's status; a Member sees only their own.
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
    <div className="flex flex-col gap-4">
      {visibleMembers.map((m) => {
        const idCard = statusFor(m.id, "ID Card");
        const certificate = statusFor(m.id, "Certificate");
        return (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
            <p className="font-heading text-sm text-ink">
              {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
            </p>
            <div className="flex items-center gap-6">
              <div>
                <span className="block font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">ID Card</span>
                <span className={`font-heading text-sm ${idCard === "Completed" ? "text-gitam" : "text-ink-muted"}`}>
                  {idCard}
                </span>
              </div>
              <div>
                <span className="block font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">Certificate</span>
                <span className={`font-heading text-sm ${certificate === "Completed" ? "text-gitam" : "text-ink-muted"}`}>
                  {certificate}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
