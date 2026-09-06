import Link from "next/link";
import { requireProfile } from "@/lib/auth/require-profile";
import { fetchAdminDashboardData } from "@/lib/dashboard/admin-data";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { Reveal } from "@/components/motion/Reveal";

const MODULES: Array<{ code: "VSP" | "BLR" | "HYD" | "all"; label: string; sub: string }> = [
  { code: "VSP", label: "Visakhapatnam", sub: "VSP" },
  { code: "BLR", label: "Bangalore", sub: "BLR" },
  { code: "HYD", label: "Hyderabad", sub: "HYD" },
  { code: "all", label: "All Campuses", sub: "Combined view" },
];

export default async function SuperDashboardPage() {
  const profile = await requireProfile(["Super Admin"]);
  const data = await fetchAdminDashboardData(profile, { campus: "all" });

  const teamsByCampus: Record<string, number> = { VSP: 0, BLR: 0, HYD: 0 };
  for (const t of data.teams) if (t.campus in teamsByCampus) teamsByCampus[t.campus] += 1;
  const totalTeams = data.teams.length;

  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8 sm:py-7">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Super Admin</span>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{profile.name}</h1>
            <p className="mt-2 font-heading text-sm text-ink-muted">Pick a campus module to manage, or the combined view.</p>
          </div>
          <LogoutButton />
        </Reveal>

        <nav aria-label="Campus modules" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link
              key={m.code}
              href={`/dashboard/admin?campus=${m.code}`}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-6 py-6 transition-colors hover:border-gold hover:bg-surface/80"
            >
              <span className="font-mono text-xs tracking-[0.2em] text-gold uppercase">{m.sub}</span>
              <span className="font-display text-2xl text-ink">{m.label}</span>
              <span className="font-heading text-sm text-ink-muted">
                {m.code === "all" ? `${totalTeams} teams total` : `${teamsByCampus[m.code]} teams`}
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
