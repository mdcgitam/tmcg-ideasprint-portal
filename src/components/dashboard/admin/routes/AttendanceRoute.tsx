import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { AdminAttendanceSection } from "@/components/dashboard/admin/sections/AdminAttendanceSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function AttendanceRoute({ profile }: { profile: ProfileRow }) {
  const { teams, membersByTeam, attendanceSessions, attendance, staffAccounts, spocs, rooms, zones } =
    await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isSpoc = profile.role === "SPOC";
  const hideZoneFilters = isSpoc || profile.role === "Zone Manager";
  // Sessions are global (shared by all 3 campuses) — only Super Admin
  // viewing "All" can add one, so every campus stays on the same list
  // instead of Campus Admins each adding their own.
  const canAddSession = profile.role === "Super Admin" && !singleCampus;

  return (
    <SectionPageShell title="Attendance" scope={scope} campus={profile.campus}>
      <AdminAttendanceSection
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
        canAddSession={canAddSession}
        teams={teams}
        membersByTeam={membersByTeam}
        attendanceSessions={attendanceSessions}
        attendance={attendance}
        staffAccounts={staffAccounts}
        spocs={spocs}
        rooms={rooms}
        zones={zones}
      />
    </SectionPageShell>
  );
}
