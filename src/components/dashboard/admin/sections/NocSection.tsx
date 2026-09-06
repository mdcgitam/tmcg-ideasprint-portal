"use client";

import { useState } from "react";
import type {
  ExitRequestRow,
  NocRow,
  ProblemStatementRow,
  ProfileRow,
  RoomRow,
  TeamRow,
  ZoneRow,
} from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { NocTeamsView } from "./NocTeamsView";
import { NocIndividualsView } from "./NocIndividualsView";

type View = "teams" | "individuals";

/** NOC — Teams / Individuals toggle, matching the reference admin NOC page. Files must be a PDF under 2MB. */
export function NocSection({
  teams,
  membersByTeam,
  nocs,
  rooms,
  zones,
  staffAccounts,
  problemStatements,
  exitRequests,
  config,
  scope,
  singleCampus = false,
  hideVenue = false,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  problemStatements: ProblemStatementRow[];
  exitRequests: ExitRequestRow[];
  config: Record<string, unknown>;
  scope: "spoc" | "admin";
  singleCampus?: boolean;
  hideVenue?: boolean;
}) {
  const [localTeams, setLocalTeams] = useState(teams);
  const [view, setView] = useState<View>("teams");
  const fadeRef = useTabFade(view);

  function onTeamRenamed(teamId: string, name: string) {
    setLocalTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, team_name: name } : t)));
  }

  function onTeamDeleted(teamId: string) {
    setLocalTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading text-xs text-ink-muted">NOC files must be a PDF under 2MB.</p>

      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "teams", label: "View by Team" },
          { value: "individuals", label: "View by Participants" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "teams" ? (
          <NocTeamsView
            teams={localTeams}
            membersByTeam={membersByTeam}
            nocs={nocs}
            rooms={rooms}
            zones={zones}
            staffAccounts={staffAccounts}
            problemStatements={problemStatements}
            exitRequests={exitRequests}
            config={config}
            scope={scope}
            singleCampus={singleCampus}
            hideVenue={hideVenue}
            onTeamRenamed={onTeamRenamed}
            onTeamDeleted={onTeamDeleted}
          />
        ) : (
          <NocIndividualsView
            teams={localTeams}
            membersByTeam={membersByTeam}
            nocs={nocs}
            rooms={rooms}
            staffAccounts={staffAccounts}
            config={config}
            scope={scope}
            singleCampus={singleCampus}
            hideVenue={hideVenue}
          />
        )}
      </div>
    </div>
  );
}
