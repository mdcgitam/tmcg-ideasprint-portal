/**
 * Shared active/inactive status rules for teams and members — used by both
 * the admin/SPOC/zone dashboards and the participant-facing team dashboard,
 * so every "Team" tab (admin or participant) agrees on the same statuses.
 */

interface MemberActiveState {
  is_active: boolean;
}

export const MEMBER_STATUS_OPTIONS = ["Active", "Inactive"] as const;
export type MemberStatusLabel = (typeof MEMBER_STATUS_OPTIONS)[number];

/** A member's status — an approved exit sets profiles.is_active = false. */
export function memberStatusLabel(member: MemberActiveState): MemberStatusLabel {
  return member.is_active ? "Active" : "Inactive";
}

export const TEAM_STATUS_OPTIONS = ["Active", "Inactive"] as const;
export type TeamStatusLabel = (typeof TEAM_STATUS_OPTIONS)[number];

/** Below this many active members, a team is Inactive. */
export const TEAM_MIN_ACTIVE = 2;

/** Active roster size — members whose registration is still active. */
export function activeMemberCount(members: MemberActiveState[]): number {
  return members.filter((m) => m.is_active).length;
}

/** A team's display status, derived from its active member count. */
export function teamActiveStatus(members: MemberActiveState[]): TeamStatusLabel {
  return activeMemberCount(members) < TEAM_MIN_ACTIVE ? "Inactive" : "Active";
}
