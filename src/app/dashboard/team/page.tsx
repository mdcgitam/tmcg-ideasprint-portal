import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { dashboardPathForRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { TeamDashboardShell } from "@/components/dashboard/team/TeamDashboardShell";
import type {
  ProfileRow,
  TeamRow,
  NocRow,
  AttendanceRow,
  AttendanceSessionRow,
  ExitRequestRow,
  NotificationRow,
  PresentationRow,
  ProblemStatementRow,
  ApprovalRequestRow,
  ConfigurationRow,
  RoomRow,
  ZoneRow,
} from "@/types/database";

export default async function TeamDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "Team Lead" && profile.role !== "Member") redirect(dashboardPathForRole(profile.role));

  if (!profile.is_active) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6 text-center">
        <div>
          <p className="font-display text-2xl text-ink">Your Registration Has Been Exited</p>
          <p className="mt-3 font-heading text-sm text-ink-muted">
            If this is a mistake, please contact the organizers.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();

  const { data: membershipRow } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const teamId = (membershipRow as { team_id: string } | null)?.team_id;

  if (!teamId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-void px-6 text-center">
        <p className="font-heading text-ink-muted">No team found for this account.</p>
      </main>
    );
  }

  const [
    { data: team },
    { data: memberRows },
    { data: nocRows },
    { data: attendanceRows },
    { data: attendanceSessionRows },
    { data: exitRequestRows },
    { data: notificationRows },
    { data: presentationRow },
    { data: pendingRequestRow },
    { data: configRows },
  ] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).single(),
    supabase.from("team_members").select("profile_id, is_lead, profiles(*)").eq("team_id", teamId),
    // No .eq(team_id)/.eq(recipient_profile_id) filters below — RLS alone
    // correctly scopes each of these to what this caller's role is allowed
    // to see (e.g. a Member only gets their own NOC row and notifications,
    // a Team Lead gets every teammate's).
    supabase.from("nocs").select("*"),
    supabase.from("attendance").select("*").eq("team_id", teamId),
    supabase.from("attendance_sessions").select("*").order("sort_order"),
    supabase.from("exit_requests").select("*"),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    supabase.from("presentations").select("*").eq("team_id", teamId).maybeSingle(),
    supabase.from("approval_requests").select("*").eq("team_id", teamId).eq("status", "Pending").maybeSingle(),
    supabase.from("configuration").select("*"),
  ]);

  const teamRow = team as TeamRow;

  const { data: roomRow } = teamRow.room_id
    ? await supabase.from("rooms").select("*").eq("id", teamRow.room_id).maybeSingle()
    : { data: null };
  const room = (roomRow ?? null) as RoomRow | null;

  const { data: zoneRow } = room?.zone_id
    ? await supabase.from("zones").select("*").eq("id", room.zone_id).maybeSingle()
    : { data: null };
  const zone = (zoneRow ?? null) as ZoneRow | null;

  const { data: spocProfile } = teamRow.spoc_profile_id
    ? await supabase.from("profiles").select("name").eq("id", teamRow.spoc_profile_id).maybeSingle()
    : { data: null };
  const spocName = (spocProfile as { name: string } | null)?.name ?? null;

  const members = ((memberRows ?? []) as unknown as { profile_id: string; is_lead: boolean; profiles: ProfileRow }[])
    .map((row) => ({ ...row.profiles, is_lead: row.is_lead }))
    .sort((a, b) => Number(b.is_lead) - Number(a.is_lead));

  const { data: currentPsRow } = teamRow.current_problem_statement_id
    ? await supabase.from("problem_statements").select("*").eq("id", teamRow.current_problem_statement_id).maybeSingle()
    : { data: null };

  const config: Record<string, unknown> = {};
  for (const row of (configRows ?? []) as ConfigurationRow[]) {
    config[row.key] = row.value;
  }

  return (
    <TeamDashboardShell
      profile={profile}
      team={teamRow}
      members={members}
      nocs={(nocRows ?? []) as NocRow[]}
      attendance={(attendanceRows ?? []) as AttendanceRow[]}
      attendanceSessions={(attendanceSessionRows ?? []) as AttendanceSessionRow[]}
      exitRequests={(exitRequestRows ?? []) as ExitRequestRow[]}
      notifications={(notificationRows ?? []) as NotificationRow[]}
      presentation={(presentationRow ?? null) as PresentationRow | null}
      currentProblemStatement={(currentPsRow ?? null) as ProblemStatementRow | null}
      pendingApprovalRequest={(pendingRequestRow ?? null) as ApprovalRequestRow | null}
      config={config}
      room={room}
      zone={zone}
      spocName={spocName}
    />
  );
}
