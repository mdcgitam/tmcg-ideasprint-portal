"use client";

import { useState } from "react";
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
import type {
  ProfileRow,
  TeamRow,
  NocRow,
  AttendanceRow,
  AttendanceSessionRow,
  ExitFormRow,
  ProblemStatementRow,
  ApprovalRequestRow,
  NotificationRow,
  RoomRow,
  ZoneRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { Reveal } from "@/components/motion/Reveal";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { useTabFade } from "@/hooks/useTabFade";
import { OverviewSection } from "./sections/OverviewSection";
import { TeamsListSection } from "./sections/TeamsListSection";
import { ApprovalsSection } from "./sections/ApprovalsSection";
import { AdminAttendanceSection } from "./sections/AdminAttendanceSection";
import { ProblemStatementsAdminSection } from "./sections/ProblemStatementsAdminSection";
import { ConfigurationSection } from "./sections/ConfigurationSection";
import { RoomsZonesSection } from "./sections/RoomsZonesSection";
import { AdminNotificationsSection } from "./sections/AdminNotificationsSection";
import { StaffAccountsSection } from "./sections/StaffAccountsSection";

export interface AdminDashboardShellProps {
  profile: ProfileRow;
  scope: "spoc" | "admin";
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  pendingApprovals: ApprovalRequestRow[];
  attendanceSessions: AttendanceSessionRow[];
  attendance: AttendanceRow[];
  nocs: NocRow[];
  exitForms: ExitFormRow[];
  problemStatements: ProblemStatementRow[];
  config: Record<string, unknown>;
  spocs: ProfileRow[];
  staffAccounts: ProfileRow[];
  notifications: NotificationRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
}

interface TabDef {
  key: string;
  icon: LucideIcon;
}

const BASE_TABS: TabDef[] = [
  { key: "Overview", icon: LayoutDashboard },
  { key: "Teams", icon: Users },
  { key: "Approvals", icon: ClipboardCheck },
  { key: "Attendance", icon: CalendarCheck },
  { key: "Notifications", icon: Bell },
];
const ADMIN_ONLY_TABS: TabDef[] = [
  { key: "Rooms & Zones", icon: DoorOpen },
  { key: "Problem Statements", icon: FileQuestion },
  { key: "Configuration", icon: Settings },
  { key: "Staff Accounts", icon: UserCog },
];

/**
 * Card grid of sections (each a tile with an icon), not the old tab strip —
 * ideasprint_changes.pdf item 15. Selecting a card swaps the panel below,
 * same underlying state machine as the old tabs, just a different picker UI.
 */
export function AdminDashboardShell(props: AdminDashboardShellProps) {
  const tabs: TabDef[] = props.scope === "admin" ? [...BASE_TABS, ...ADMIN_ONLY_TABS] : BASE_TABS;
  const [tab, setTab] = useState<string>(tabs[0].key);
  const fadeRef = useTabFade(tab);

  const allMembers = Object.values(props.membersByTeam).flat();
  const unreadCount = props.notifications.filter((n) => !n.read).length;

  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8 sm:py-7">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">
              {props.scope === "admin" ? "Super Admin" : "SPOC"}
            </span>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{props.profile.name}</h1>
          </div>
          <LogoutButton />
        </Reveal>

        <nav aria-label="Dashboard sections" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tabs.map(({ key, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative flex flex-col items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors ${
                  active
                    ? "border-gold bg-gold/10"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface/80"
                }`}
              >
                <Icon className={active ? "size-6 text-gold" : "size-6 text-ink-muted"} strokeWidth={1.5} />
                <span className={`font-heading text-sm ${active ? "text-gold" : "text-ink"}`}>{key}</span>
                {key === "Notifications" && unreadCount > 0 && (
                  <span className="absolute top-3 right-3 rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-ink">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div ref={fadeRef}>
          {tab === "Overview" && (
            <OverviewSection
              scope={props.scope}
              teams={props.teams}
              allMembers={allMembers}
              pendingApprovals={props.pendingApprovals}
              nocs={props.nocs}
              exitForms={props.exitForms}
            />
          )}
          {tab === "Teams" && (
            <TeamsListSection
              teams={props.teams}
              membersByTeam={props.membersByTeam}
              nocs={props.nocs}
              exitForms={props.exitForms}
              scope={props.scope}
              staffAccounts={props.staffAccounts}
              rooms={props.rooms}
              zones={props.zones}
              problemStatements={props.problemStatements}
            />
          )}
          {tab === "Approvals" && <ApprovalsSection pendingApprovals={props.pendingApprovals} teams={props.teams} />}
          {tab === "Attendance" && (
            <AdminAttendanceSection
              teams={props.teams}
              membersByTeam={props.membersByTeam}
              attendanceSessions={props.attendanceSessions}
              attendance={props.attendance}
              scope={props.scope}
              staffAccounts={props.staffAccounts}
            />
          )}
          {tab === "Notifications" && <AdminNotificationsSection notifications={props.notifications} />}
          {tab === "Rooms & Zones" && props.scope === "admin" && (
            <RoomsZonesSection teams={props.teams} rooms={props.rooms} zones={props.zones} spocs={props.spocs} staffAccounts={props.staffAccounts} />
          )}
          {tab === "Problem Statements" && props.scope === "admin" && (
            <ProblemStatementsAdminSection problemStatements={props.problemStatements} />
          )}
          {tab === "Configuration" && props.scope === "admin" && <ConfigurationSection config={props.config} />}
          {tab === "Staff Accounts" && props.scope === "admin" && (
            <StaffAccountsSection staffAccounts={props.staffAccounts} />
          )}
        </div>
      </div>
    </main>
  );
}
