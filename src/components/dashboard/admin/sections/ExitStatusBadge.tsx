import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { memberStatusLabel } from "@/lib/dashboard/team-status";

export {
  MEMBER_STATUS_OPTIONS,
  memberStatusLabel,
  TEAM_STATUS_OPTIONS,
  TEAM_MIN_ACTIVE,
  activeMemberCount,
  teamActiveStatus,
} from "@/lib/dashboard/team-status";
export type { MemberStatusLabel, TeamStatusLabel } from "@/lib/dashboard/team-status";

/** Small status badge for a member's active/inactive state, reused across Teams/TeamDetailModal/Overview. */
export function ExitStatusBadge({ member }: { member: TeamMemberProfile }) {
  const label = memberStatusLabel(member);
  const className = label === "Inactive" ? "text-danger" : "text-ink-muted";
  return <span className={`font-heading text-xs ${className}`}>{label}</span>;
}
