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

/** A team's display status — "Inactive" once any member's exit request has been approved. This is the one status system for the team-level Status column/filter (no separate source of truth). */
export function teamActiveStatus(members: TeamMemberProfile[], exitRequests: ExitRequestRow[]): TeamStatusLabel {
  const hasExited = members.some((m) => isExited(exitRequests.find((r) => r.profile_id === m.id)));
  return hasExited ? "Inactive" : "Active";
}
