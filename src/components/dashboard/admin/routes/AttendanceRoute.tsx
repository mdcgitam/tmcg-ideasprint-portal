import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminAttendanceSection } from "@/components/dashboard/admin/sections/AdminAttendanceSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function AttendanceRoute({ profile, roomId }: { profile: ProfileRow; roomId?: string }) {
  const { teams, membersByTeam, attendanceSessions, attendance, staffAccounts, spocs, rooms } =
    await fetchAdminDashboardData(profile, roomId ? { roomId } : undefined);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

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
