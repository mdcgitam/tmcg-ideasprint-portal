/**
 * Hand-written row/RPC types for the tables and functions the app actually
 * touches — not a full mirror of the SQL migrations. The `Database` block
 * below is NOT wired into the Supabase clients (see the comment in
 * src/lib/supabase/client.ts for why — a postgrest-js inference issue) and
 * is effectively unused/vestigial; only the plain Row interfaces are
 * imported elsewhere, for casting query/RPC results. Replace this file
 * wholesale with `supabase gen types` once the CLI is linked.
 */

export type UserRole = "Super Admin" | "SPOC" | "Team Lead" | "Member";
export type TeamStatus = "Registered" | "Active" | "Pending Approval" | "Qualified for Grand Finale" | "Exited";
export type PsStatus = "Hidden" | "Released";
export type AttendanceStatus = "Present" | "Absent";
export type MealStatus = "Not Redeemed" | "Redeemed";
export type NocStatus = "Not Uploaded" | "Uploaded" | "Verified" | "Missing";
export type PresentationStatus = "Not Uploaded" | "Uploaded";
export type MemberExitStatus = "Requested" | "Approved" | "Rejected";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface ProfileRow {
  id: string;
  auth_user_id: string | null;
  user_id: string;
  campus: string;
  role: UserRole;
  name: string;
  gitam_email: string;
  phone: string;
  reg_no: string;
  year_of_study: string;
  school: string;
  department: string;
  branch: string;
  gender: string;
  stay: string;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamRow {
  id: string;
  team_id: string;
  team_name: string;
  member_count: number;
  team_lead_profile_id: string | null;
  spoc_profile_id: string | null;
  room_id: string | null;
  status: TeamStatus;
  current_problem_statement_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ZoneRow {
  id: string;
  name: string;
  zone_manager_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomRow {
  id: string;
  name: string;
  zone_id: string | null;
  spoc_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  team_id: string;
  profile_id: string;
  is_lead: boolean;
  joined_at: string;
}

export interface RegisterTeamResult {
  team_id: string;
  user_ids: string[];
}

export interface ProblemStatementRow {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: PsStatus;
  created_at: string;
  updated_at: string;
}

export interface ProblemStatementSelectionRow {
  id: string;
  team_id: string;
  problem_statement_id: string;
  selected_by: string;
  selected_at: string;
  is_initial: boolean;
}

export interface AttendanceSessionRow {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}

export interface AttendanceRow {
  id: string;
  session_id: string;
  profile_id: string;
  team_id: string;
  status: AttendanceStatus;
  recorded_by: string;
  recorded_at: string;
}

export interface FoodCouponRow {
  id: string;
  profile_id: string;
  lunch_status: MealStatus;
  lunch_recorded_by: string | null;
  lunch_recorded_at: string | null;
  dinner_status: MealStatus;
  dinner_recorded_by: string | null;
  dinner_recorded_at: string | null;
}

export interface NocRow {
  id: string;
  profile_id: string;
  file_path: string | null;
  status: NocStatus;
  uploaded_by: string | null;
  uploaded_at: string | null;
  updated_at: string;
}

export interface ExitRequestRow {
  id: string;
  profile_id: string;
  team_id: string;
  file_path: string | null;
  status: MemberExitStatus;
  reason: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface PresentationRow {
  id: string;
  team_id: string;
  file_path: string | null;
  status: PresentationStatus;
  uploaded_by: string | null;
  uploaded_at: string | null;
}

export interface NotificationRow {
  id: string;
  recipient_profile_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface ApprovalRequestRow {
  id: string;
  team_id: string;
  request_type: string;
  requested_changes: Record<string, unknown>;
  current_snapshot: Record<string, unknown>;
  requested_by: string;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ConfigurationRow {
  key: string;
  value: unknown;
  description: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow>;
        Update: Partial<ProfileRow>;
        Relationships: never[];
      };
      teams: {
        Row: TeamRow;
        Insert: Partial<TeamRow>;
        Update: Partial<TeamRow>;
        Relationships: never[];
      };
      team_members: {
        Row: TeamMemberRow;
        Insert: Partial<TeamMemberRow>;
        Update: Partial<TeamMemberRow>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      register_team: {
        Args: { p_payload: unknown };
        Returns: RegisterTeamResult;
      };
      check_team_name_available: {
        Args: { p_team_name: string };
        Returns: boolean;
      };
      check_participant_available: {
        Args: { p_field: string; p_value: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
