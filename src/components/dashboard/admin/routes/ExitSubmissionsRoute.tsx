import type { ProfileRow } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ExitSubmissionsSection } from "@/components/dashboard/admin/sections/ExitSubmissionsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ExitSubmissionsRoute({ profile }: { profile: ProfileRow }) {
  const { exitRequests, teams, membersByTeam, rooms, zones, staffAccounts } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;
  const isSpoc = profile.role === "SPOC";
  const hideZoneFilters = isSpoc || profile.role === "Zone Manager";
  // A no-show team was never at the event to file an exit request — drop
  // it from view here; still visible (and reversible) in Rooms and Venues
  // or the Profile module.
  const activeTeams = teams.filter((t) => t.is_active);

  // History's "Reviewed By" needs names beyond staffAccounts (campus-scoped,
  // 0058) — a reviewer can be a Super Admin (no campus) reviewing across
  // campuses. Dedicated, unscoped lookup, same pattern as the team
  // dashboard's reviewerNames (0059/0061 grants the read via RLS).
  const supabase = await createClient();
  const reviewerIds = Array.from(new Set(exitRequests.map((r) => r.reviewed_by).filter((id): id is string => Boolean(id))));
  const { data: reviewerRows } = reviewerIds.length > 0
    ? await supabase.from("profiles").select("id, name").in("id", reviewerIds)
    : { data: [] };
  const reviewerNames = Object.fromEntries(((reviewerRows ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));

  return (
    <SectionPageShell title="Exit Form Submissions" scope={scope} campus={profile.campus}>
      <ExitSubmissionsSection
        teams={activeTeams}
        membersByTeam={membersByTeam}
        exitRequests={exitRequests}
        reviewerNames={reviewerNames}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        singleCampus={singleCampus}
        hideZoneFilters={hideZoneFilters}
        hideVenueFilter={isSpoc}
        hideSpocFilter={isSpoc}
      />
    </SectionPageShell>
  );
}
