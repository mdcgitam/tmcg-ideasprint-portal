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
  // Only Super Admin can add sessions (never Campus Admin — keeps each
  // campus from drifting apart). A session created while viewing "All"
  // applies to every campus; one created while a specific campus module
  // is selected is scoped to just that campus (profile.campus already
  // reflects the picked module for a Super Admin — effectiveAdminProfile).
  const canAddSession = profile.role === "Super Admin";
  // A no-show team drops off Attendance entirely (nothing to mark
  // attendance for) — reversible from Rooms and Venues or the Profile
  // module, both of which still show every team regardless of status.
  const activeTeams = teams.filter((t) => t.is_active);

  return (
    <SectionPageShell title="Attendance" scope={scope} campus={profile.campus}>
      <AdminAttendanceSection
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
        canAddSession={canAddSession}
        addSessionCampus={profile.campus}
        teams={activeTeams}
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
