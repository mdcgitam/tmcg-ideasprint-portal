"use client";

import { useState } from "react";
import type {
  AttendanceRow,
  AttendanceSessionRow,
  TeamRow,
  NocRow,
  ExitRequestRow,
  ProfileRow,
  RoomRow,
  ZoneRow,
  ProblemStatementRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { TeamsByTeamView } from "./TeamsByTeamView";
import { TeamsByMembersView } from "./TeamsByMembersView";

type View = "by-team" | "by-members";

export function TeamsPage({
  teams,
  membersByTeam,
  nocs,
  exitRequests,
  attendance,
  attendanceSessions,
  scope,
  staffAccounts,
  rooms,
  zones,
  problemStatements,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  exitRequests: ExitRequestRow[];
  attendance: AttendanceRow[];
  attendanceSessions: AttendanceSessionRow[];
  scope: "spoc" | "admin";
  staffAccounts: ProfileRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  problemStatements: ProblemStatementRow[];
}) {
  const [localTeams, setLocalTeams] = useState(teams);
  const [view, setView] = useState<View>("by-team");
  const fadeRef = useTabFade(view);

  function onTeamRenamed(teamId: string, name: string) {
    setLocalTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, team_name: name } : t)));
  }

  function onTeamDeleted(teamId: string) {
    setLocalTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "by-team", label: "View by Team" },
          { value: "by-members", label: "View by Members" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "by-team" ? (
          <TeamsByTeamView
            teams={localTeams}
            membersByTeam={membersByTeam}
            problemStatements={problemStatements}
            rooms={rooms}
            zones={zones}
            staffAccounts={staffAccounts}
            exitRequests={exitRequests}
            nocs={nocs}
            attendance={attendance}
            attendanceSessions={attendanceSessions}
            scope={scope}
            onTeamRenamed={onTeamRenamed}
            onTeamDeleted={onTeamDeleted}
          />
        ) : (
          <TeamsByMembersView
            teams={localTeams}
            membersByTeam={membersByTeam}
            nocs={nocs}
            exitRequests={exitRequests}
            scope={scope}
            staffAccounts={staffAccounts}
            rooms={rooms}
            zones={zones}
            problemStatements={problemStatements}
            onTeamRenamed={onTeamRenamed}
            onTeamDeleted={onTeamDeleted}
          />
        )}
      </div>
    </div>
  );
}
