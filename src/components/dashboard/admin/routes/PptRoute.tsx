import type { ProfileRow } from "@/types/database";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { PptSection } from "@/components/dashboard/admin/sections/PptSection";
import { SectionPageShell } from "@/components/dashboard/admin/routes/SectionPageShell";

export async function PptRoute({ profile }: { profile: ProfileRow }) {
  const {
    teams,
    membersByTeam,
    presentations,
    rooms,
    zones,
    staffAccounts,
    problemStatements,
    config,
  } = await fetchAdminDashboardData(profile);
  const scope = profile.role === "SPOC" || profile.role === "Zone Manager" ? "spoc" : "admin";
  const singleCampus = profile.role !== "Super Admin" || profile.campus != null;

  return (
    <SectionPageShell title="PPT" scope={scope} campus={profile.campus}>
      <PptSection
        singleCampus={singleCampus}
        teams={teams}
        membersByTeam={membersByTeam}
        presentations={presentations}
        rooms={rooms}
        zones={zones}
        staffAccounts={staffAccounts}
        problemStatements={problemStatements}
        config={config}
        scope={scope}
      />
    </SectionPageShell>
  );
}
