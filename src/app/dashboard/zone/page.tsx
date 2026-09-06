import { requireProfile } from "@/lib/auth/require-profile";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { Reveal } from "@/components/motion/Reveal";

export default async function ZoneManagerDashboardPage() {
  const profile = await requireProfile(["Zone Manager"]);

  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <Reveal className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8 sm:py-7">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Zone Manager</span>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{profile.name}</h1>
            <p className="mt-3 font-heading text-sm text-ink-muted">
              Your dashboard is being set up — you&rsquo;ll oversee the SPOCs of the venues in your zone here.
            </p>
          </div>
          <LogoutButton />
        </Reveal>
      </div>
    </main>
  );
}
