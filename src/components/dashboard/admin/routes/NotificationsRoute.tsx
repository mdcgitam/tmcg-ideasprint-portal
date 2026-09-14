import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { createClient } from "@/lib/supabase/server";
import { AdminNotificationsSection } from "@/components/dashboard/admin/sections/AdminNotificationsSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

// No venue tab bar here — notifications aren't venue-scoped data; the
// compose box has its own Who / Where pickers.
export async function NotificationsRoute({ profile }: { profile: ProfileRow }) {
  const { notifications, rooms, zones, staffAccounts, teams, membersByTeam } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";

  // Only this route needs the Sent tab's data, so it's fetched here rather
  // than bloated onto fetchAdminDashboardData (shared by every other admin
  // module page). RLS already scopes notification_broadcasts to the
  // sender, but the explicit filter is kept as defense-in-depth, matching
  // the rest of this codebase's convention.
  const supabase = await createClient();
  const { data: sentBroadcasts } = await supabase
    .from("notification_broadcasts")
    .select("*")
    .eq("sender_profile_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <SectionPageShell title="Notifications" scope={scope} campus={profile.campus}>
      <AdminNotificationsSection
        profileId={profile.id}
        role={profile.role}
        notifications={notifications}
        sentBroadcasts={sentBroadcasts ?? []}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        teams={teams}
        membersByTeam={membersByTeam}
      />
    </SectionPageShell>
  );
}
