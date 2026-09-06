import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { RoomsZonesRoute } from "@/components/dashboard/admin/routes/RoomsZonesRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const profile = await requireProfile(["Super Admin", "Campus Admin"]);
  const { profile: p } = effectiveAdminProfile(profile, (await searchParams).campus);
  return <RoomsZonesRoute profile={p} />;
}
