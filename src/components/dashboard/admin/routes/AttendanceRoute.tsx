import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminAttendanceSection } from "@/components/dashboard/admin/sections/AdminAttendanceSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function AttendanceRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, attendanceSessions, attendance, staffAccounts, spocs, rooms } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" ? "spoc" : "admin";

  return (
    <SectionPageShell title="Attendance" scope={scope}>
      <AdminAttendanceSection
        teams={teams}
        membersByTeam={membersByTeam}
        attendanceSessions={attendanceSessions}
        attendance={attendance}
        scope={scope}
        staffAccounts={staffAccounts}
        spocs={spocs}
        rooms={rooms}
      />
    </SectionPageShell>
  );
}
