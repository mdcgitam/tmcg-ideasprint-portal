import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { TeamsRoute } from "@/components/dashboard/admin/routes/TeamsRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  const { profile: p } = effectiveAdminProfile(profile, (await searchParams).campus);
  return <TeamsRoute profile={p} />;
}
