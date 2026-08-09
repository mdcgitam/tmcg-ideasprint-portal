import { createClient } from "@/lib/supabase/client";

/** Same pattern as src/lib/dashboard/team-actions.ts — called directly from the browser with the caller's own session. */
export class DashboardActionError extends Error {}

function friendlyError(raw: string): string {
  if (raw.includes("NOT_ALLOWED")) return "You don't have permission to do this.";
  if (raw.includes("ALREADY_RESOLVED")) return "This request was already resolved.";
  if (raw.includes("REQUEST_NOT_FOUND")) return "That request couldn't be found.";
  if (raw.includes("PARTICIPANT_NOT_FOUND")) return "That participant couldn't be found.";
  if (raw.includes("NOT_A_SPOC")) return "That account isn't a SPOC — assign the SPOC role first.";
  if (raw.includes("DUPLICATE_PS_NUMBER")) return "That problem statement number is already in use.";
  if (raw.includes("DUPLICATE_EMAIL")) {
    const email = raw.split(":").slice(1).join(":").trim();
    return email ? `${email} is already registered.` : "That email is already registered.";
  }
  if (raw.includes("INVALID_ROLE")) return "Invalid role.";
  if (raw.includes("INVALID_STATUS") || raw.includes("INVALID_DECISION") || raw.includes("INVALID_MEAL")) {
    return "Invalid value submitted.";
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

export function recordFoodRedemption(profileId: string, meal: "lunch" | "dinner", status: "Redeemed" | "Not Redeemed") {
  return callRpc<null>("record_food_redemption", { p_profile_id: profileId, p_meal: meal, p_status: status });
}

export function extendProblemStatementDeadline(teamId: string, extendedUntil: string, reason: string) {
  return callRpc<null>("extend_problem_statement_deadline", {
    p_team_id: teamId,
    p_extended_until: extendedUntil,
    p_reason: reason,
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

/** spocProfileId: null unassigns the team. */
export function assignSpoc(teamId: string, spocProfileId: string | null) {
  return callRpc<null>("assign_spoc", { p_team_id: teamId, p_spoc_profile_id: spocProfileId });
}

export function updateUserRole(profileId: string, newRole: "Super Admin" | "SPOC" | "Team Lead" | "Member") {
  return callRpc<null>("update_user_role", { p_profile_id: profileId, p_new_role: newRole });
}

export function setConfiguration(key: string, value: unknown, description: string) {
  return callRpc<null>("set_configuration", { p_key: key, p_value: value, p_description: description });
}

export function markNotificationRead(notificationId: string) {
  return callRpc<null>("mark_notification_read", { p_notification_id: notificationId });
}

export interface CreateStaffInput {
  name: string;
  email: string;
  role: "SPOC" | "Super Admin";
}

/** Creates a bare profiles row (no team, no participant fields) — the whole point of this RPC vs. registration. */
export function createStaffProfile(input: CreateStaffInput) {
  return callRpc<string>("create_staff_profile", { p_name: input.name, p_email: input.email, p_role: input.role });
}
