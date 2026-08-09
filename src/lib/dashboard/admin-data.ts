import { createClient } from "@/lib/supabase/server";
import type {
  ProfileRow,
  TeamRow,
  NocRow,
  AttendanceRow,
  AttendanceSessionRow,
  FoodCouponRow,
  ExitFormRow,
  ProblemStatementRow,
  ApprovalRequestRow,
  ConfigurationRow,
  NotificationRow,
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
  foodCoupons: FoodCouponRow[];
  nocs: NocRow[];
  exitForms: ExitFormRow[];
  problemStatements: ProblemStatementRow[];
  config: Record<string, unknown>;
  spocs: ProfileRow[];
  staffAccounts: ProfileRow[];
  notifications: NotificationRow[];
}

/**
 * Shared by both /dashboard/spoc and /dashboard/admin — every query here is
 * a broad `select *`, deliberately with no manual scope filtering. RLS
 * (supabase/migrations/0001-0003) already scopes every one of these tables
 * correctly per caller: a SPOC's queries return only their assigned teams'
 * rows, Super Admin's return everything. Same pattern as the Team Dashboard
 * in src/app/dashboard/team/page.tsx.
 */
export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createClient();

  const [
    { data: teams },
    { data: teamMemberRows },
    { data: pendingApprovals },
    { data: attendanceSessions },
    { data: attendance },
    { data: foodCoupons },
    { data: nocs },
    { data: exitForms },
    { data: problemStatements },
    { data: configRows },
    { data: spocs },
    { data: staffAccounts },
    { data: notifications },
  ] = await Promise.all([
    supabase.from("teams").select("*").order("created_at", { ascending: false }),
    supabase.from("team_members").select("team_id, profile_id, is_lead, profiles(*)"),
    supabase.from("approval_requests").select("*").eq("status", "Pending"),
    supabase.from("attendance_sessions").select("*").order("sort_order"),
    supabase.from("attendance").select("*"),
    supabase.from("food_coupons").select("*"),
    supabase.from("nocs").select("*"),
    supabase.from("exit_forms").select("*"),
    supabase.from("problem_statements").select("*").order("number"),
    supabase.from("configuration").select("*"),
    supabase.from("profiles").select("*").eq("role", "SPOC"),
    supabase.from("profiles").select("*").in("role", ["SPOC", "Super Admin"]).order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
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

  return {
    teams: (teams ?? []) as TeamRow[],
    membersByTeam,
    pendingApprovals: (pendingApprovals ?? []) as ApprovalRequestRow[],
    attendanceSessions: (attendanceSessions ?? []) as AttendanceSessionRow[],
    attendance: (attendance ?? []) as AttendanceRow[],
    foodCoupons: (foodCoupons ?? []) as FoodCouponRow[],
    nocs: (nocs ?? []) as NocRow[],
    exitForms: (exitForms ?? []) as ExitFormRow[],
    problemStatements: (problemStatements ?? []) as ProblemStatementRow[],
    config,
    spocs: (spocs ?? []) as ProfileRow[],
    staffAccounts: (staffAccounts ?? []) as ProfileRow[],
    notifications: (notifications ?? []) as NotificationRow[],
  };
}
