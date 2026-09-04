import { requireProfile } from "@/lib/auth/require-profile";
import { NocPptRoute } from "@/components/dashboard/admin/routes/NocPptRoute";

export default async function Page() {
  const profile = await requireProfile(["Super Admin", "SPOC"]);
  return <NocPptRoute profile={profile} />;
}
