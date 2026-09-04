import { requireProfile } from "@/lib/auth/require-profile";
import { ApprovalsRoute } from "@/components/dashboard/admin/routes/ApprovalsRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "SPOC"]);
  return <ApprovalsRoute profile={profile} />;
}
