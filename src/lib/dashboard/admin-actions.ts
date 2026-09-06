import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { DashboardActionError, type SelectedProblemStatement } from "@/lib/dashboard/team-actions";

/** Same pattern as src/lib/dashboard/team-actions.ts — called directly from the browser with the caller's own session. */
export { DashboardActionError };

function friendlyError(raw: string): string {
  if (raw.includes("NOT_ALLOWED")) return "You don't have permission to do this.";
  if (raw.includes("ALREADY_RESOLVED")) return "This request was already resolved.";
  if (raw.includes("REQUEST_NOT_FOUND")) return "That request couldn't be found.";
  if (raw.includes("TEAM_MIN_SIZE"))
    return "A team can't go below 3 members. To exit a 3-member team, every member must submit an exit form together.";
  if (raw.includes("TEAM_MAX_SIZE")) return "This team already has 4 members — you can't add another.";
  if (raw.includes("MEMBER_EXITED")) return "That member has exited the event — they're no longer marked for attendance.";
  if (raw.includes("TEAM_INACTIVE")) return "This team is inactive (fewer than 3 active members) and isn't part of attendance.";
  if (raw.includes("PARTICIPANT_NOT_FOUND")) return "That participant couldn't be found.";
  if (raw.includes("NOT_A_SPOC")) return "That account isn't a SPOC — assign the SPOC role first.";
  if (raw.includes("NOT_A_ZONE_MANAGER")) return "Only a Zone Manager account can manage a zone.";
  if (raw.includes("DUPLICATE_PS_NUMBER")) return "That problem statement number is already in use.";
  if (raw.includes("DUPLICATE_ROOM_NAME")) return "A room with that name already exists.";
  if (raw.includes("DUPLICATE_ZONE_NAME")) return "A zone with that name already exists.";
  if (raw.includes("ROOM_NOT_FOUND")) return "That venue no longer exists — refresh the page.";
  if (raw.includes("ZONE_NOT_FOUND")) return "That zone no longer exists — refresh the page.";
  if (raw.includes("TEAM_NOT_FOUND")) return "That team couldn't be found.";
  if (raw.includes("ALREADY_LEAD")) return "That member is already the Team Lead.";
  if (raw.includes("CANNOT_DELETE_LEAD")) return "This member is the Team Lead — delete the whole team instead.";
  if (raw.includes("DUPLICATE_EMAIL")) {
    const email = raw.split(":").slice(1).join(":").trim();
    return email ? `${email} is already registered.` : "That email is already registered.";
  }
  if (raw.includes("DUPLICATE_REGNO")) return "That registration/roll number is already in use.";
  if (raw.includes("DUPLICATE_PHONE")) return "That phone number is already in use.";
  if (raw.includes("DUPLICATE_TEAM_NAME")) return "A team with that name already exists.";
  if (raw.includes("INVALID_ROLE")) return "Invalid role.";
  if (raw.includes("INVALID_STATUS") || raw.includes("INVALID_DECISION")) {
    return "Invalid value submitted.";
  }
  if (raw.includes("INVALID_AUDIENCE")) return "Choose an audience to notify.";
  if (raw.includes("INVALID_BROADCAST")) return "Title and message can't be empty.";
  if (raw.includes("INVALID_PS_NUMBER")) return "That problem statement number wasn't found or isn't live yet.";
  if (raw.includes("CROSS_CAMPUS")) return "That record belongs to another campus.";
  if (raw.includes("CAMPUS_REQUIRED")) return "Pick a campus first.";
  if (raw.includes("INVALID_CAMPUS")) return "That isn't a valid campus.";
  // validate_member_academics (supabase/migrations/0026) raises
  // `CODE: <member> — <field-specific sentence>` — show the sentence.
  const academic = raw.match(
    /(?:MISSING_FIELD|INVALID_NAME|INVALID_REGNO_PREFIX|INVALID_EMAIL_DOMAIN|INVALID_PHONE|INVALID_GRADUATION|INVALID_PROGRAM_FOR_GRADUATION|INVALID_YEAR_FOR_PROGRAM|INVALID_SCHOOL|INVALID_DEPARTMENT_FOR_SCHOOL|INVALID_BRANCH_FOR_DEPARTMENT|INVALID_GENDER|INVALID_STAY):\s*([^]+)/,
  );
  if (academic) {
    const detail = academic[1].trim();
    return detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : "One or more fields are invalid.";
  }
  return "Something went wrong. Please try again.";
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new DashboardActionError(friendlyError(error.message));
  return data as T;
}

export function resolveApprovalRequest(requestId: string, decision: "Approved" | "Rejected") {
  return callRpc<null>("resolve_approval_request", { p_request_id: requestId, p_decision: decision });
}

/** Approving deactivates the member's profile server-side (resolve_member_exit). */
export function resolveMemberExit(requestId: string, decision: "Approved" | "Rejected") {
  return callRpc<null>("resolve_member_exit", { p_request_id: requestId, p_decision: decision });
}

export function recordAttendance(sessionId: string, profileId: string, status: "Present" | "Absent") {
  return callRpc<null>("record_attendance", { p_session_id: sessionId, p_profile_id: profileId, p_status: status });
}

export function createAttendanceSession(name: string, startsAt: string | null, endsAt: string | null, sortOrder: number) {
  return callRpc<string>("create_attendance_session", {
    p_name: name,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_sort_order: sortOrder,
  });
}

export function extendProblemStatementDeadline(teamId: string, extendedUntil: string, reason: string) {
  return callRpc<null>("extend_problem_statement_deadline", {
    p_team_id: teamId,
    p_extended_until: extendedUntil,
    p_reason: reason,
  });
}

/** Bypasses the Team-Lead-only + selection-window checks in select_problem_statement — for an admin/SPOC correcting a team's pick directly. */
export function adminSetProblemStatement(teamId: string, psNumber: string) {
  return callRpc<SelectedProblemStatement>("admin_set_problem_statement", {
    p_team_id: teamId,
    p_ps_number: psNumber,
  });
}

export interface UpsertProblemStatementInput {
  id: string | null;
  number: string;
  title: string;
  description: string;
  status: "Hidden" | "Released";
}

export function upsertProblemStatement(input: UpsertProblemStatementInput) {
  return callRpc<string>("upsert_problem_statement", {
    p_id: input.id,
    p_number: input.number,
    p_title: input.title,
    p_description: input.description,
    p_status: input.status,
  });
}

export function updateUserRole(profileId: string, newRole: UserRole) {
  return callRpc<null>("update_user_role", { p_profile_id: profileId, p_new_role: newRole });
}

export function setConfiguration(key: string, value: unknown, description: string) {
  return callRpc<null>("set_configuration", { p_key: key, p_value: value, p_description: description });
}

export function markNotificationRead(notificationId: string) {
  return callRpc<null>("mark_notification_read", { p_notification_id: notificationId });
}

/** Roles a broadcast can be narrowed to. "" = every role the sender may reach; a comma list (e.g. "Team Lead,Member") targets several. */
export type BroadcastRoleFilter =
  | ""
  | "Campus Admin"
  | "SPOC"
  | "Zone Manager"
  | "Team Lead"
  | "Member"
  | "Team Lead,Member";
export type BroadcastScope = "all" | "zone" | "venue" | "campus";

/**
 * Sends a notification. The server enforces the sender's reach:
 *   Super Admin  -> Campus Admin / SPOC / Zone Manager / Team Lead / Member (any campus)
 *   Campus Admin -> SPOC / Zone Manager / Team Lead / Member (own campus)
 *   Zone Manager -> SPOC in their zone + Team Leads / Members of their zone
 *   SPOC         -> Team Leads / Members in their room(s) only
 * `scope` narrows by area ("all" | a zone | a venue); `roleFilter` narrows by role.
 * Returns the recipient count.
 */
export function broadcastNotification(
  title: string,
  message: string,
  scope: BroadcastScope,
  scopeValue: string,
  roleFilter: BroadcastRoleFilter = "",
) {
  return callRpc<number>("broadcast_notification", {
    p_title: title,
    p_message: message,
    p_scope: scope,
    p_scope_value: scopeValue,
    p_role_filter: roleFilter,
  });
}

export interface CreateStaffInput {
  name: string;
  email: string;
  /** Required when the caller is the global Super Admin; ignored (own campus is used) for a Campus Admin. */
  campus?: "VSP" | "BLR" | "HYD" | null;
}

/** SPOC account. Campus Admin -> own campus; Super Admin -> must pass `campus`. */
export function createSpoc(input: CreateStaffInput) {
  return callRpc<string>("create_spoc", { p_name: input.name, p_email: input.email, p_campus: input.campus ?? null });
}

/** Campus Admin account — Super Admin only, `campus` required. */
export function createCampusAdmin(input: CreateStaffInput & { campus: "VSP" | "BLR" | "HYD" }) {
  return callRpc<string>("create_campus_admin", { p_name: input.name, p_email: input.email, p_campus: input.campus });
}

/** Zone Manager account — supervises the SPOCs of the venues in a zone. Campus Admin -> own campus / Super Admin -> must pass `campus`. */
export function createZoneManager(input: CreateStaffInput) {
  return callRpc<string>("create_zone_manager", { p_name: input.name, p_email: input.email, p_campus: input.campus ?? null });
}

// ── Rooms & Zones (item 11: SPOC is assigned to a room only, never a team/person) ──

export function createRoom(name: string, zoneId: string | null, campus?: "VSP" | "BLR" | "HYD" | null) {
  return callRpc<string>("create_room", { p_name: name, p_zone_id: zoneId, p_campus: campus ?? null });
}

export function createZone(name: string, managerProfileId: string | null, campus?: "VSP" | "BLR" | "HYD" | null) {
  return callRpc<string>("create_zone", { p_name: name, p_manager_profile_id: managerProfileId, p_campus: campus ?? null });
}

export function assignZoneManager(zoneId: string, managerProfileId: string | null) {
  return callRpc<null>("assign_zone_manager", { p_zone_id: zoneId, p_manager_profile_id: managerProfileId });
}

export function updateRoomName(roomId: string, name: string) {
  return callRpc<null>("update_room_name", { p_room_id: roomId, p_name: name });
}

export function updateZoneName(zoneId: string, name: string) {
  return callRpc<null>("update_zone_name", { p_zone_id: zoneId, p_name: name });
}

export function deleteRoom(roomId: string) {
  return callRpc<null>("delete_room", { p_room_id: roomId });
}

export function deleteZone(zoneId: string) {
  return callRpc<null>("delete_zone", { p_zone_id: zoneId });
}

export function assignRoomToZone(roomId: string, zoneId: string | null) {
  return callRpc<null>("assign_room_to_zone", { p_room_id: roomId, p_zone_id: zoneId });
}

/** spocProfileId: null unassigns the room's SPOC. Cascades to every team currently in the room. */
export function assignSpocToRoom(roomId: string, spocProfileId: string | null) {
  return callRpc<null>("assign_spoc_to_room", { p_room_id: roomId, p_spoc_profile_id: spocProfileId });
}

/** roomId: null pulls the team out of its room (and clears its inherited SPOC). */
export function assignTeamToRoom(teamId: string, roomId: string | null) {
  return callRpc<null>("assign_team_to_room", { p_team_id: teamId, p_room_id: roomId });
}

// ── Deletes (item 11: "Delete teams, members and SPOCs") ─────────────────

export function deleteTeam(teamId: string) {
  return callRpc<null>("delete_team", { p_team_id: teamId });
}

export function deleteMember(profileId: string) {
  return callRpc<null>("delete_member", { p_profile_id: profileId });
}

export function deleteSpoc(profileId: string) {
  return callRpc<null>("delete_spoc", { p_profile_id: profileId });
}

export function deleteZoneManager(profileId: string) {
  return callRpc<null>("delete_zone_manager", { p_profile_id: profileId });
}

// ── Edits (admin-only: rename a team, edit a member's/participant's details) ──

export interface UpdateMemberInput {
  name: string;
  gitam_email: string;
  phone: string;
  reg_no: string;
  graduation: string;
  program: string;
  year_of_study: string;
  school: string;
  department: string;
  branch: string;
  gender: string;
  stay: string;
}

/** Adds a Member (never a Team Lead) to a team. Rejected once the team has 4 members. Campus Admin / Super Admin only. */
export function addTeamMember(teamId: string, input: UpdateMemberInput) {
  return callRpc<string>("add_team_member", {
    p_team_id: teamId,
    p_name: input.name,
    p_gitam_email: input.gitam_email,
    p_phone: input.phone,
    p_reg_no: input.reg_no,
    p_graduation: input.graduation,
    p_program: input.program,
    p_year_of_study: input.year_of_study,
    p_school: input.school,
    p_department: input.department,
    p_branch: input.branch,
    p_gender: input.gender,
    p_stay: input.stay,
  });
}

export function updateMember(profileId: string, input: UpdateMemberInput) {
  return callRpc<null>("update_member", {
    p_profile_id: profileId,
    p_name: input.name,
    p_gitam_email: input.gitam_email,
    p_phone: input.phone,
    p_reg_no: input.reg_no,
    p_graduation: input.graduation,
    p_program: input.program,
    p_year_of_study: input.year_of_study,
    p_school: input.school,
    p_department: input.department,
    p_branch: input.branch,
    p_gender: input.gender,
    p_stay: input.stay,
  });
}

export function updateTeamName(teamId: string, teamName: string) {
  return callRpc<null>("update_team_name", { p_team_id: teamId, p_team_name: teamName });
}

export function changeTeamLead(teamId: string, newLeadProfileId: string) {
  return callRpc<null>("change_team_lead", { p_team_id: teamId, p_new_lead_profile_id: newLeadProfileId });
}
