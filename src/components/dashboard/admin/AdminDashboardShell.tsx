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
  type LucideIcon,
} from "lucide-react";
import type { ProfileRow } from "@/types/database";
import { Reveal } from "@/components/motion/Reveal";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

export interface AdminDashboardShellProps {
  profile: ProfileRow;
  scope: "spoc" | "admin";
  unreadCount: number;
}

interface CardDef {
  key: string;
  slug: string;
  icon: LucideIcon;
}

const BASE_CARDS: CardDef[] = [
  { key: "Overview", slug: "overview", icon: LayoutDashboard },
  { key: "Teams", slug: "teams", icon: Users },
  { key: "Approvals", slug: "approvals", icon: ClipboardCheck },
  { key: "Attendance", slug: "attendance", icon: CalendarCheck },
  { key: "Notifications", slug: "notifications", icon: Bell },
];
const ADMIN_ONLY_CARDS: CardDef[] = [
  { key: "Rooms & Zones", slug: "rooms-zones", icon: DoorOpen },
  { key: "Problem Statements", slug: "problem-statements", icon: FileQuestion },
  { key: "Configuration", slug: "configuration", icon: Settings },
  { key: "Staff Accounts", slug: "staff-accounts", icon: UserCog },
];

/**
 * Pure launcher grid (ideasprint_changes.pdf item 15, revised): each card
 * just links out to its own page, opened in a new tab — no inline content
 * swap here anymore, that logic now lives per-section under
 * src/app/dashboard/{admin,spoc}/<slug>/page.tsx.
 */
export function AdminDashboardShell({ profile, scope, unreadCount }: AdminDashboardShellProps) {
  const cards: CardDef[] = scope === "admin" ? [...BASE_CARDS, ...ADMIN_ONLY_CARDS] : BASE_CARDS;

  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8 sm:py-7">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">
              {scope === "admin" ? "Super Admin" : "SPOC"}
            </span>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{profile.name}</h1>
          </div>
          <LogoutButton />
        </Reveal>

        <nav aria-label="Dashboard sections" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map(({ key, slug, icon: Icon }) => (
            <Link
              key={key}
              href={`/dashboard/${scope}/${slug}`}
              target="_blank"
              className="relative flex flex-col items-start gap-3 rounded-xl border border-border bg-surface px-4 py-4 text-left transition-colors hover:border-border-strong hover:bg-surface/80"
            >
              <Icon className="size-6 text-ink-muted" strokeWidth={1.5} />
              <span className="font-heading text-sm text-ink">{key}</span>
              {key === "Notifications" && unreadCount > 0 && (
                <span className="absolute top-3 right-3 rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-ink">
                  {unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
