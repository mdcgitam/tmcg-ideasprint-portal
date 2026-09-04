import { createClient } from "@/lib/supabase/server";
import type {
  ProfileRow,
  TeamRow,
  NocRow,
  AttendanceRow,
  AttendanceSessionRow,
  ExitRequestRow,
  PresentationRow,
  ProblemStatementRow,
  ApprovalRequestRow,
  ConfigurationRow,
  NotificationRow,
  RoomRow,
  ZoneRow,
} from "@/types/database";

export interface TeamMemberProfile extends ProfileRow {
  is_lead: boolean;
}

export interface AdminDashboardData {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  pendingApprovals: ApprovalRequestRow[];
  attendanceSessions: AttendanceSessionRow[];
  attendance: AttendanceRow[];
  nocs: NocRow[];
  exitRequests: ExitRequestRow[];
  presentations: PresentationRow[];
  problemStatements: ProblemStatementRow[];
  config: Record<string, unknown>;
  spocs: ProfileRow[];
  staffAccounts: ProfileRow[];
  notifications: NotificationRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
}

/**
 * Shared by both /dashboard/spoc and /dashboard/admin — every query here is
 * a broad `select *`. RLS (supabase/migrations/0001-0003) already scopes
 * every one of these tables correctly per caller: a SPOC's queries return
 * only their assigned teams' rows, Super Admin's return everything. Same
 * pattern as the Team Dashboard in src/app/dashboard/team/page.tsx.
 *
 * The `profile` param drives one extra, explicit filter on top of that: for
 * a SPOC, every team-keyed field in the returned data is re-narrowed to
 * `teams.spoc_profile_id === profile.id` in application code, not just
 * trusted to RLS. This is deliberate defense-in-depth — RLS state on a live
 * database isn't something the app can verify at request time, so "a SPOC
 * only ever sees their assigned teams" is guaranteed here regardless of it.
 * No-op for Super Admin.
 */
export async function fetchAdminDashboardData(profile: ProfileRow): Promise<AdminDashboardData> {
  const supabase = await createClient();

  const [
    { data: teams },
    { data: teamMemberRows },
    { data: pendingApprovals },
    { data: attendanceSessions },
    { data: attendance },
    { data: nocs },
    { data: exitRequests },
    { data: presentations },
    { data: problemStatements },
    { data: configRows },
    { data: spocs },
    { data: staffAccounts },
    { data: notifications },
    { data: rooms },
    { data: zones },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("created_at", { ascending: false }),
    supabase.from("team_members").select("team_id, profile_id, is_lead, profiles(*)"),
    supabase.from("approval_requests").select("*").eq("status", "Pending"),
    supabase.from("attendance_sessions").select("*").order("sort_order"),
    supabase.from("attendance").select("*"),
    supabase.from("nocs").select("*"),
    supabase.from("exit_requests").select("*"),
    supabase.from("presentations").select("*"),
    supabase.from("problem_statements").select("*").order("number"),
    supabase.from("configuration").select("*"),
    supabase.from("profiles").select("*").eq("role", "SPOC"),
    supabase.from("profiles").select("*").in("role", ["SPOC", "Super Admin"]).order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    supabase.from("rooms").select("*").order("name"),
    supabase.from("zones").select("*").order("name"),
  ]);

  const membersByTeam: Record<string, TeamMemberProfile[]> = {};
  for (const row of (teamMemberRows ?? []) as unknown as {
    team_id: string;
    profile_id: string;
    is_lead: boolean;
    profiles: ProfileRow;
  }[]) {
    const list = membersByTeam[row.team_id] ?? (membersByTeam[row.team_id] = []);
    list.push({ ...row.profiles, is_lead: row.is_lead });
  }
  for (const list of Object.values(membersByTeam)) {
    list.sort((a, b) => Number(b.is_lead) - Number(a.is_lead));
  }

  const config: Record<string, unknown> = {};
  for (const row of (configRows ?? []) as ConfigurationRow[]) {
    config[row.key] = row.value;
  }

  let scopedTeams = (teams ?? []) as TeamRow[];
  let scopedMembersByTeam = membersByTeam;
  let scopedPendingApprovals = (pendingApprovals ?? []) as ApprovalRequestRow[];
  let scopedAttendance = (attendance ?? []) as AttendanceRow[];
  let scopedNocs = (nocs ?? []) as NocRow[];
  let scopedExitRequests = (exitRequests ?? []) as ExitRequestRow[];
  let scopedPresentations = (presentations ?? []) as PresentationRow[];

  if (profile.role !== "Super Admin") {
    scopedTeams = scopedTeams.filter((t) => t.spoc_profile_id === profile.id);
    const teamIds = new Set(scopedTeams.map((t) => t.id));

    scopedMembersByTeam = Object.fromEntries(Object.entries(membersByTeam).filter(([teamId]) => teamIds.has(teamId)));
    const memberIds = new Set(Object.values(scopedMembersByTeam).flatMap((members) => members.map((m) => m.id)));

    scopedPendingApprovals = scopedPendingApprovals.filter((a) => teamIds.has(a.team_id));
    scopedAttendance = scopedAttendance.filter((a) => teamIds.has(a.team_id));
    scopedExitRequests = scopedExitRequests.filter((e) => teamIds.has(e.team_id));
    scopedPresentations = scopedPresentations.filter((p) => teamIds.has(p.team_id));
    scopedNocs = scopedNocs.filter((n) => memberIds.has(n.profile_id));
  }

  return {
    teams: scopedTeams,
    membersByTeam: scopedMembersByTeam,
    pendingApprovals: scopedPendingApprovals,
    attendanceSessions: (attendanceSessions ?? []) as AttendanceSessionRow[],
    attendance: scopedAttendance,
    nocs: scopedNocs,
    exitRequests: scopedExitRequests,
    presentations: scopedPresentations,
    problemStatements: (problemStatements ?? []) as ProblemStatementRow[],
    config,
    spocs: (spocs ?? []) as ProfileRow[],
    staffAccounts: (staffAccounts ?? []) as ProfileRow[],
    notifications: (notifications ?? []) as NotificationRow[],
    rooms: (rooms ?? []) as RoomRow[],
    zones: (zones ?? []) as ZoneRow[],
  };
}

export interface DashboardCardCounts {
  teams: number;
  pendingApprovals: number;
  unreadNotifications: number;
  missingNocs: number;
  missingPpt: number;
  rooms: number;
  problemStatements: number;
  staffAccounts: number;
}

/** Badge counts for the dashboard's card grid — one number per card, computed from data the caller already fetched. */
export function computeDashboardCardCounts(data: AdminDashboardData): DashboardCardCounts {
  const missingNocs = Object.values(data.membersByTeam)
    .flat()
    .filter((m) => data.nocs.find((n) => n.profile_id === m.id)?.status !== "Uploaded").length;

  const missingPpt = data.teams.filter(
    (t) => data.presentations.find((p) => p.team_id === t.id)?.status !== "Uploaded",
  ).length;

  const pendingExitRequests = data.exitRequests.filter((r) => r.status === "Requested").length;

  return {
    teams: data.teams.length,
    pendingApprovals: data.pendingApprovals.length + pendingExitRequests,
    unreadNotifications: data.notifications.filter((n) => !n.read).length,
    missingNocs,
    missingPpt,
    rooms: data.rooms.length,
    problemStatements: data.problemStatements.length,
    staffAccounts: data.staffAccounts.length,
  };
}
