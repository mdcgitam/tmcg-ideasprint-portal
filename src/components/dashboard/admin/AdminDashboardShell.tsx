"use client";

import { useState } from "react";
import type {
  ProfileRow,
  TeamRow,
  NocRow,
  AttendanceRow,
  AttendanceSessionRow,
  FoodCouponRow,
  ExitFormRow,
  ProblemStatementRow,
  ApprovalRequestRow,
  NotificationRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { Reveal } from "@/components/motion/Reveal";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { useTabFade } from "@/hooks/useTabFade";
import { OverviewSection } from "./sections/OverviewSection";
import { TeamsListSection } from "./sections/TeamsListSection";
import { ApprovalsSection } from "./sections/ApprovalsSection";
import { AdminAttendanceSection } from "./sections/AdminAttendanceSection";
import { AdminFoodSection } from "./sections/AdminFoodSection";
import { ProblemStatementsAdminSection } from "./sections/ProblemStatementsAdminSection";
import { ConfigurationSection } from "./sections/ConfigurationSection";
import { SpocAssignmentSection } from "./sections/SpocAssignmentSection";
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
  foodCoupons: FoodCouponRow[];
  nocs: NocRow[];
  exitForms: ExitFormRow[];
  problemStatements: ProblemStatementRow[];
  config: Record<string, unknown>;
  spocs: ProfileRow[];
  staffAccounts: ProfileRow[];
  notifications: NotificationRow[];
}

const BASE_TABS = ["Overview", "Teams", "Approvals", "Attendance", "Food", "Notifications"] as const;
const ADMIN_ONLY_TABS = ["Problem Statements", "Configuration", "SPOC Assignment", "Staff Accounts"] as const;

export function AdminDashboardShell(props: AdminDashboardShellProps) {
  const tabs: readonly string[] = props.scope === "admin" ? [...BASE_TABS, ...ADMIN_ONLY_TABS] : BASE_TABS;
  const [tab, setTab] = useState<string>(tabs[0]);
  const fadeRef = useTabFade(tab);

  const allMembers = Object.values(props.membersByTeam).flat();
  const unreadCount = props.notifications.filter((n) => !n.read).length;

  return (
    <main className="min-h-screen bg-void px-6 pt-28 pb-16 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-10 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8 sm:py-7">
          <div>
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">
              {props.scope === "admin" ? "Super Admin" : "SPOC"}
            </span>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{props.profile.name}</h1>
          </div>
          <LogoutButton />
        </Reveal>

        <nav aria-label="Dashboard sections" className="mb-10 flex flex-wrap gap-2 border-b border-border pb-4">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 font-heading text-sm transition-colors ${
                tab === t ? "bg-gold text-void" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t}
              {t === "Notifications" && unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-ink">{unreadCount}</span>
              )}
            </button>
          ))}
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
              foodCoupons={props.foodCoupons}
            />
          )}
          {tab === "Teams" && (
            <TeamsListSection
              teams={props.teams}
              membersByTeam={props.membersByTeam}
              nocs={props.nocs}
              exitForms={props.exitForms}
              scope={props.scope}
              spocs={props.spocs}
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
            />
          )}
          {tab === "Food" && (
            <AdminFoodSection teams={props.teams} membersByTeam={props.membersByTeam} foodCoupons={props.foodCoupons} />
          )}
          {tab === "Notifications" && <AdminNotificationsSection notifications={props.notifications} />}
          {tab === "Problem Statements" && props.scope === "admin" && (
            <ProblemStatementsAdminSection problemStatements={props.problemStatements} />
          )}
          {tab === "Configuration" && props.scope === "admin" && <ConfigurationSection config={props.config} />}
          {tab === "SPOC Assignment" && props.scope === "admin" && (
            <SpocAssignmentSection teams={props.teams} spocs={props.spocs} />
          )}
          {tab === "Staff Accounts" && props.scope === "admin" && (
            <StaffAccountsSection staffAccounts={props.staffAccounts} />
          )}
        </div>
      </div>
    </main>
  );
}
