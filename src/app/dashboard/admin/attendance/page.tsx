import { requireProfile } from "@/lib/auth/require-profile";
import { effectiveAdminProfile } from "@/lib/auth/super-campus";
import { AttendanceRoute } from "@/components/dashboard/admin/routes/AttendanceRoute";

export default async function Page({ searchParams }: { searchParams: Promise<{ campus?: string }> }) {
  const profile = await requireProfile(["Super Admin", "Campus Admin", "SPOC"]);
  const { profile: p } = effectiveAdminProfile(profile, (await searchParams).campus);
  return <AttendanceRoute profile={p} />;
}
