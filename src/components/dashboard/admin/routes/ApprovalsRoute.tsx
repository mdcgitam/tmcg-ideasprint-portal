import type { ProfileRow } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { ApprovalsSection } from "@/components/dashboard/admin/sections/ApprovalsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function ApprovalsRoute({ profile }: { profile: ProfileRow }) {
  const { approvalRequests, teams, membersByTeam, staffAccounts } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;

  // History's "Reviewed By" needs names beyond staffAccounts (campus-scoped)
  // — a reviewer can be a Super Admin (no campus) reviewing across campuses.
  // Dedicated, unscoped lookup, same pattern as Exit Requests' (0061).
  const supabase = await createClient();
  const reviewerIds = Array.from(new Set(approvalRequests.map((r) => r.reviewed_by).filter((id): id is string => Boolean(id))));
  const { data: reviewerRows } = reviewerIds.length > 0
    ? await supabase.from("profiles").select("id, name").in("id", reviewerIds)
    : { data: [] };
  const reviewerNames = Object.fromEntries(((reviewerRows ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));

  return (
    <SectionPageShell title="Profile Requests" scope={scope} campus={profile.campus}>
      <ApprovalsSection
        approvalRequests={approvalRequests}
        teams={teams}
        membersByTeam={membersByTeam}
        staffAccounts={staffAccounts}
        reviewerNames={reviewerNames}
        singleCampus={singleCampus}
      />
    </SectionPageShell>
  );
}
