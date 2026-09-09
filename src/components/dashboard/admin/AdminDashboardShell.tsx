import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  CalendarCheck,
  DoorOpen,
  FileQuestion,
  Settings,
  Bell,
  UserCog,
  FileCheck2,
  Presentation,
  LogOut,
  IdCard,
  type LucideIcon,
} from "lucide-react";
import type { ProfileRow } from "@/types/database";
import { Reveal } from "@/components/motion/Reveal";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

export interface AdminDashboardShellProps {
  profile: ProfileRow;
  scope: "spoc" | "admin" | "zone";
  /** Set for the global Super Admin: which campus module is active ("all" = every campus). */
  superCampus?: "VSP" | "BLR" | "HYD" | "all";
  /** Zone Manager only: "<zone name(s)>_<campus>", shown next to the role label. */
  zoneLabel?: string;
  /** SPOC only: "<zone>_<venue>_<campus>", shown next to the role label. */
  spocLabel?: string;
}

const CAMPUS_TABS: Array<{ code: "VSP" | "BLR" | "HYD" | "all"; label: string }> = [
  { code: "VSP", label: "Visakhapatnam" },
  { code: "BLR", label: "Bangalore" },
  { code: "HYD", label: "Hyderabad" },
  { code: "all", label: "All" },
];

interface CardDef {
  key: string;
  slug: string;
  icon: LucideIcon;
}

// Order follows the requested module layout: Overview, Profile, Attendance,
// NOC, Problem Statements, PPT, ID Cards & Certificates, Zones and Venues,
// Approvals, Notifications, Exit Submissions, Staff Accounts, Configuration.
// Zones and Venues, Staff Accounts, and Configuration stay admin-privileged
// (Super Admin / Campus Admin only) — everything else, Problem Statements
// included, is shared by every role (each already scoped to just their own
// teams/zone by fetchAdminDashboardData).
interface OrderedCardDef extends CardDef {
  adminOnly?: boolean;
}

const ALL_CARDS: OrderedCardDef[] = [
  { key: "Overview", slug: "overview", icon: LayoutDashboard },
  { key: "Profile", slug: "teams", icon: Users },
  { key: "Attendance", slug: "attendance", icon: CalendarCheck },
  { key: "NOC", slug: "noc", icon: FileCheck2 },
  { key: "Problem Statements", slug: "problem-statements", icon: FileQuestion },
  { key: "PPT", slug: "ppt", icon: Presentation },
  { key: "ID Cards & Certificates", slug: "id-cards", icon: IdCard },
  { key: "Zones and Venues", slug: "rooms-zones", icon: DoorOpen, adminOnly: true },
  { key: "Approvals", slug: "approvals", icon: ClipboardCheck },
  { key: "Notifications", slug: "notifications", icon: Bell },
  { key: "Exit Submissions", slug: "exit-submissions", icon: LogOut },
  { key: "Staff Accounts", slug: "staff-accounts", icon: UserCog, adminOnly: true },
  { key: "Configuration", slug: "configuration", icon: Settings, adminOnly: true },
];

/**
 * Pure launcher grid (ideasprint_changes.pdf item 15, revised): each card
 * just links out to its own page, opened in a new tab — no inline content
 * swap here anymore, that logic now lives per-section under
 * src/app/dashboard/{admin,spoc}/<slug>/page.tsx.
 */
export function AdminDashboardShell({
  profile,
  scope,
  superCampus,
  zoneLabel,
  spocLabel,
}: AdminDashboardShellProps) {
  const cards: CardDef[] = scope === "admin" ? ALL_CARDS : ALL_CARDS.filter((c) => !c.adminOnly);
  const isSuper = profile.role === "Super Admin";
  const roleLabel = isSuper
    ? "Super Admin"
    : scope === "admin"
      ? "Campus Admin"
      : scope === "zone"
        ? `Zone Manager${zoneLabel ? ` (${zoneLabel})` : ""}`
        : `SPOC${spocLabel ? ` (${spocLabel})` : ""}`;
  const q = isSuper && superCampus ? `?campus=${superCampus}` : "";

  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8 sm:py-7">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{roleLabel}</span>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{profile.name}</h1>
          </div>
          <LogoutButton />
        </Reveal>

        {isSuper && (
          <Reveal className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="mr-1 font-mono text-xs tracking-[0.2em] text-ink-faint uppercase">Campus</span>
            <Link
              href="/dashboard/super"
              className="rounded-full border border-border px-3 py-1 font-heading text-xs text-ink-muted transition-colors hover:border-gold hover:text-gold"
            >
              ← Modules
            </Link>
            {CAMPUS_TABS.map((c) => (
              <Link
                key={c.code}
                href={`/dashboard/admin?campus=${c.code}`}
                className={`rounded-full px-3 py-1 font-heading text-xs transition-colors ${
                  (superCampus ?? "all") === c.code
                    ? "bg-gold text-void"
                    : "border border-border text-ink-muted hover:border-gold hover:text-gold"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </Reveal>
        )}

        <nav aria-label="Dashboard sections" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map(({ key, slug, icon: Icon }) => (
            <Link
              key={key}
              href={`/dashboard/${scope}/${slug}${q}`}
              target="_blank"
              className="relative flex flex-col items-start gap-3 rounded-xl border border-border bg-surface px-4 py-4 text-left transition-colors hover:border-border-strong hover:bg-surface/80"
            >
              <Icon className="size-6 text-ink-muted" strokeWidth={1.5} />
              <span className="font-heading text-sm text-ink">{key}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
