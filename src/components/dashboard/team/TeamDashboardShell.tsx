"use client";

import { useState } from "react";
import type {
  ProfileRow,
  TeamRow,
  NocRow,
  AttendanceRow,
  AttendanceSessionRow,
  ExitRequestRow,
  NotificationRow,
  PresentationRow,
  ProblemStatementRow,
  ApprovalRequestRow,
  RoomRow,
  ZoneRow,
} from "@/types/database";
import { Reveal } from "@/components/motion/Reveal";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { useTabFade } from "@/hooks/useTabFade";
import { ProfileSection } from "./sections/ProfileSection";
import { ProblemStatementSection } from "./sections/ProblemStatementSection";
import { AttendanceSection } from "./sections/AttendanceSection";
import { NocSection } from "./sections/NocSection";
import { ExitRequestSection } from "./sections/ExitRequestSection";
import { PresentationSection } from "./sections/PresentationSection";
import { NotificationsSection } from "./sections/NotificationsSection";

export interface TeamMemberProfile extends ProfileRow {
  is_lead: boolean;
}

export interface TeamDashboardShellProps {
  profile: ProfileRow;
  team: TeamRow;
  members: TeamMemberProfile[];
  nocs: NocRow[];
  attendance: AttendanceRow[];
  attendanceSessions: AttendanceSessionRow[];
  exitRequests: ExitRequestRow[];
  notifications: NotificationRow[];
  presentation: PresentationRow | null;
  currentProblemStatement: ProblemStatementRow | null;
  pendingApprovalRequest: ApprovalRequestRow | null;
  config: Record<string, unknown>;
  room: RoomRow | null;
  zone: ZoneRow | null;
  spocName: string | null;
}

const TABS = ["Profile", "Problem Statement", "Attendance", "NOC", "Presentation", "Exit Request", "Notifications"] as const;
type Tab = (typeof TABS)[number];

export function TeamDashboardShell(props: TeamDashboardShellProps) {
  const [tab, setTab] = useState<Tab>("Profile");
  const isLead = props.profile.role === "Team Lead";
  const fadeRef = useTabFade(tab);
  const unreadCount = props.notifications.filter((n) => !n.read).length;

  return (
    <main className="min-h-screen bg-void px-6 pt-12 pb-16 sm:px-10 sm:pt-14 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-10 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8 sm:py-7">
          <div>
            {/* font-heading (Geist), not font-mono — JetBrains Mono renders a dotted zero, which reads badly in Team IDs. */}
            <span className="font-heading text-xs font-medium tracking-[0.3em] text-gold uppercase">
              {props.team.team_id} · {props.team.status}
            </span>
            <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{props.team.team_name}</h1>
            <p className="mt-2 font-heading text-sm text-ink-muted">
              Signed in as {props.profile.name} ({props.profile.role}) · {props.profile.user_id}
            </p>
          </div>
          <LogoutButton />
        </Reveal>

        <nav aria-label="Dashboard sections" className="mb-10 flex flex-wrap gap-2 border-b border-border pb-4">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative rounded-full px-4 py-2 font-heading text-sm transition-colors ${
                tab === t ? "bg-gold text-void" : "text-ink-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {t}
              {t === "Notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-ink">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div ref={fadeRef}>
          {tab === "Profile" && (
            <ProfileSection
              profile={props.profile}
              team={props.team}
              members={props.members}
              pendingApprovalRequest={props.pendingApprovalRequest}
              isLead={isLead}
              room={props.room}
              zone={props.zone}
              spocName={props.spocName}
            />
          )}
          {tab === "Problem Statement" && (
            <ProblemStatementSection
              team={props.team}
              currentProblemStatement={props.currentProblemStatement}
              config={props.config}
              isLead={isLead}
            />
          )}
          {tab === "Attendance" && (
            <AttendanceSection
              members={props.members}
              attendance={props.attendance}
              attendanceSessions={props.attendanceSessions}
              spocName={props.spocName}
            />
          )}
          {tab === "NOC" && <NocSection profile={props.profile} members={props.members} nocs={props.nocs} isLead={isLead} />}
          {tab === "Presentation" && (
            <PresentationSection
              team={props.team}
              presentation={props.presentation}
              isLead={isLead}
              config={props.config}
            />
          )}
          {tab === "Exit Request" && (
            <ExitRequestSection
              profile={props.profile}
              members={props.members}
              exitRequests={props.exitRequests}
              isLead={isLead}
            />
          )}
          {tab === "Notifications" && (
            <NotificationsSection profileId={props.profile.id} notifications={props.notifications} />
          )}
        </div>
      </div>
    </main>
  );
}
