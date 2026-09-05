import { createClient } from "@/lib/supabase/client";

/**
 * Unlike registration's submitRegistration (a pre-auth Server Action using
 * the service-role client), these RPCs are called directly from the
 * browser with the caller's own session — each function's own permission
 * check (supabase/migrations/0002_team_dashboard.sql) is what makes that
 * safe, since none of these tables grant authenticated write access
 * directly.
 */

export class DashboardActionError extends Error {}

function friendlyError(raw: string): string {
  if (raw.includes("NOT_TEAM_LEAD")) return "Only the Team Lead can do this.";
  if (raw.includes("NOT_ALLOWED")) return "You don't have permission to do this.";
  if (raw.includes("REQUEST_ALREADY_PENDING")) {
    return "You already have a pending edit request — wait for it to be reviewed before submitting another.";
  }
  if (raw.includes("SELECTION_NOT_CONFIGURED")) return "Problem statement selection hasn't been opened yet.";
  if (raw.includes("SELECTION_CLOSED")) return "The problem statement selection window is currently closed.";
  if (raw.includes("INVALID_PS_NUMBER")) return "That problem statement number wasn't found. Double-check it and try again.";
  if (raw.includes("PARTICIPANT_NOT_FOUND")) return "That participant couldn't be found.";
  if (raw.includes("REQUEST_NOT_FOUND")) return "That request couldn't be found.";
  if (raw.includes("INVALID_DECISION")) return "Invalid decision.";
  if (raw.includes("DEADLINE_PASSED")) {
    return "Time exceeded — the upload deadline has passed. Ask your SPOC or Super Admin to extend it.";
  }
  return "Something went wrong. Please try again.";
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new DashboardActionError(friendlyError(error.message));
  return data as T;
}

export function submitTeamEditRequest(teamId: string, currentSnapshot: unknown, requestedChanges: unknown) {
  return callRpc<string>("submit_team_edit_request", {
    p_team_id: teamId,
    p_current_snapshot: currentSnapshot,
    p_requested_changes: requestedChanges,
  });
}

export interface SelectedProblemStatement {
  id: string;
  number: string;
  title: string;
}

export function selectProblemStatement(teamId: string, psNumber: string) {
  return callRpc<SelectedProblemStatement>("select_problem_statement", { p_team_id: teamId, p_ps_number: psNumber });
}

export function recordNocMetadata(profileId: string, filePath: string) {
  return callRpc<null>("record_noc_metadata", { p_profile_id: profileId, p_file_path: filePath });
}

export function deleteNoc(profileId: string) {
  return callRpc<null>("delete_noc", { p_profile_id: profileId });
}

export function extendNocDeadline(profileId: string, deadlineIso: string) {
  return callRpc<null>("extend_noc_deadline", { p_profile_id: profileId, p_deadline: deadlineIso });
}

export function requestMemberExit(profileId: string, filePath: string, reason: string) {
  return callRpc<null>("request_member_exit", { p_profile_id: profileId, p_file_path: filePath, p_reason: reason });
}

export function deleteExitRequest(profileId: string) {
  return callRpc<null>("delete_exit_request", { p_profile_id: profileId });
}

export function markNotificationRead(notificationId: string) {
  return callRpc<null>("mark_notification_read", { p_notification_id: notificationId });
}

export function recordPresentation(teamId: string, filePath: string) {
  return callRpc<null>("record_presentation", { p_team_id: teamId, p_file_path: filePath });
}

export function deletePresentation(teamId: string) {
  return callRpc<null>("delete_presentation", { p_team_id: teamId });
}

export function extendPresentationDeadline(teamId: string, deadlineIso: string) {
  return callRpc<null>("extend_presentation_deadline", { p_team_id: teamId, p_deadline: deadlineIso });
}

// ── Storage (file bytes never touch our Next.js server — straight to Supabase) ──

export async function uploadNocFile(profileId: string, file: File): Promise<string> {
  const supabase = createClient();
  const path = `${profileId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("noc-uploads").upload(path, file, { upsert: true });
  if (error) throw new DashboardActionError("Couldn't upload the file — please try again.");
  return path;
}

export async function deleteNocFile(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("noc-uploads").remove([path]);
  if (error) throw new DashboardActionError("Couldn't delete the file — please try again.");
}

export async function uploadExitRequestFile(profileId: string, file: File): Promise<string> {
  const supabase = createClient();
  const path = `${profileId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("exit-requests").upload(path, file, { upsert: true });
  if (error) throw new DashboardActionError("Couldn't upload the file — please try again.");
  return path;
}

export async function deleteExitRequestFile(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("exit-requests").remove([path]);
  if (error) throw new DashboardActionError("Couldn't delete the file — please try again.");
}

export async function uploadPresentationFile(teamId: string, file: File): Promise<string> {
  const supabase = createClient();
  const path = `${teamId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("ppt-uploads").upload(path, file, { upsert: true });
  if (error) throw new DashboardActionError("Couldn't upload the file — please try again.");
  return path;
}

export async function deletePresentationFile(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("ppt-uploads").remove([path]);
  if (error) throw new DashboardActionError("Couldn't delete the file — please try again.");
}

export async function getSignedUrl(
  bucket: "noc-uploads" | "exit-requests" | "ppt-uploads",
  path: string,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) return null;
  return data.signedUrl;
}
