import type { ExitRequestRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";

export const MEMBER_STATUS_OPTIONS = ["Active", "Exit Requested", "Exited", "Rejected"] as const;
export type MemberStatusLabel = (typeof MEMBER_STATUS_OPTIONS)[number];

/** Single source of truth for a member's exit-request status label — used by the badge, CSV exports, and Status filters alike. */
export function exitStatusLabel(request: ExitRequestRow | undefined): MemberStatusLabel {
  if (!request) return "Active";
  return request.status === "Approved" ? "Exited" : request.status === "Requested" ? "Exit Requested" : "Rejected";
}

/** Small status badge for a member's exit-request state, reused across Teams/TeamDetailModal/Overview. */
export function ExitStatusBadge({ request }: { request: ExitRequestRow | undefined }) {
  const label = exitStatusLabel(request);
  const className = label === "Exited" ? "text-danger" : label === "Exit Requested" ? "text-gold" : "text-ink-muted";
  return <span className={`font-heading text-xs ${className}`}>{label}</span>;
}

/** True once a member's exit request has been approved (i.e. they're deactivated). */
export function isExited(request: ExitRequestRow | undefined): boolean {
  return request?.status === "Approved";
}

export const TEAM_STATUS_OPTIONS = ["Active", "Inactive"] as const;
export type TeamStatusLabel = (typeof TEAM_STATUS_OPTIONS)[number];

/** Minimum viable team. Below this many active members the team is Inactive. */
export const TEAM_MIN_ACTIVE = 3;

/** Active roster size — members whose registration is still active (an
 *  approved exit sets profiles.is_active = false). */
export function activeMemberCount(members: TeamMemberProfile[]): number {
  return members.filter((m) => m.is_active).length;
}

/**
 * A team's display status. Exiting one member from a 4-person team leaves 3
 * active and the team stays Active; a 3-person team only dissolves when all
 * three exit, dropping active members below the minimum → Inactive. One
 * status system for the team-level Status column/filter.
 */
export function teamActiveStatus(members: TeamMemberProfile[]): TeamStatusLabel {
  return activeMemberCount(members) < TEAM_MIN_ACTIVE ? "Inactive" : "Active";
}
