import { requireProfile } from "@/lib/auth/require-profile";
import { StaffAccountsRoute } from "@/components/dashboard/admin/routes/StaffAccountsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin"]);
  return <StaffAccountsRoute profile={profile} />;
}
