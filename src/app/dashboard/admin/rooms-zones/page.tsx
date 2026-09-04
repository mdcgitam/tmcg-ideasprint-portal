import { requireProfile } from "@/lib/auth/require-profile";
import { RoomsZonesRoute } from "@/components/dashboard/admin/routes/RoomsZonesRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin"]);
  return <RoomsZonesRoute profile={profile} />;
}
