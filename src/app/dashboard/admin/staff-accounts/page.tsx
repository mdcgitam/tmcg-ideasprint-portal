import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { StaffAccountsRoute } from "@/components/dashboard/admin/routes/StaffAccountsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const profile = await requireProfile(["Super Admin", "Campus Admin"]);
  const { profile: p } = effectiveAdminProfile(profile, (await searchParams).campus);
  return <StaffAccountsRoute profile={p} />;
}
