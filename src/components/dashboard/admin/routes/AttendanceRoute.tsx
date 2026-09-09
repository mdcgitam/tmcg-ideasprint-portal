import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminAttendanceSection } from "@/components/dashboard/admin/sections/AdminAttendanceSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function AttendanceRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, attendanceSessions, attendance, staffAccounts, spocs, rooms, zones } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;

  return (
    <SectionPageShell title="Attendance" scope={scope} campus={profile.campus}>
      <AdminAttendanceSection
        singleCampus={singleCampus}
        teams={teams}
        membersByTeam={membersByTeam}
        attendanceSessions={attendanceSessions}
        attendance={attendance}
        scope={scope}
        staffAccounts={staffAccounts}
        spocs={spocs}
        rooms={rooms}
        zones={zones}
      />
    </SectionPageShell>
  );
}
