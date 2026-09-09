import { requireProfile } from "@/lib/auth/require-profile";
import { PptRoute } from "@/components/dashboard/admin/routes/PptRoute";

export default async function Page() {
  const profile = await requireProfile(["Zone Manager"]);
  return <PptRoute profile={profile} />;
}
