import { requireProfile } from "@/lib/auth/require-profile";
import { NocRoute } from "@/components/dashboard/admin/routes/NocRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  return <NocRoute profile={profile} />;
}
