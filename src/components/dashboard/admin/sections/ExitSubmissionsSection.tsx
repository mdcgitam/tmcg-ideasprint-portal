"use client";

import { useState } from "react";
import type { ApprovalRequestRow, ExitRequestRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";
import { ExitTeamsView } from "./ExitTeamsView";
import { ExitIndividualsView } from "./ExitIndividualsView";
import { ExitHistorySection } from "./ExitHistorySection";

type View = "teams" | "individuals" | "history";

/**
 * Exit Requests — Teams / Participants / History, same shape as the NOC
 * module. A team can't have a single member exit once it's down to 3
 * active members — every one of them must also be exiting (enforced
 * server-side in resolve_member_exit) — the Teams tab flags that in
 * progress; Participants is a flat, filterable queue; History is a
 * read-only, merged timeline of resolved exit AND profile-edit requests.
 */
export function ExitSubmissionsSection({
  teams,
  membersByTeam,
  exitRequests,
  approvalRequests,
  rooms,
  zones,
  staffAccounts,
  singleCampus = false,
  hideZoneFilters = false,
  hideVenueFilter = false,
  hideSpocFilter = false,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  exitRequests: ExitRequestRow[];
  approvalRequests: ApprovalRequestRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  singleCampus?: boolean;
  hideZoneFilters?: boolean;
  hideVenueFilter?: boolean;
  hideSpocFilter?: boolean;
}) {
  const [view, setView] = useState<View>("teams");
  const fadeRef = useTabFade(view);

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "teams", label: "View by Team" },
          { value: "individuals", label: "View by Participants" },
          { value: "history", label: "History" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "teams" && (
          <ExitTeamsView
            teams={teams}
            membersByTeam={membersByTeam}
            exitRequests={exitRequests}
            rooms={rooms}
            zones={zones}
            staffAccounts={staffAccounts}
            singleCampus={singleCampus}
            hideZoneFilters={hideZoneFilters}
            hideVenueFilter={hideVenueFilter}
            hideSpocFilter={hideSpocFilter}
          />
        )}
        {view === "individuals" && (
          <ExitIndividualsView
            teams={teams}
            membersByTeam={membersByTeam}
            exitRequests={exitRequests}
            rooms={rooms}
            zones={zones}
            staffAccounts={staffAccounts}
            singleCampus={singleCampus}
            hideZoneFilters={hideZoneFilters}
            hideVenueFilter={hideVenueFilter}
            hideSpocFilter={hideSpocFilter}
          />
        )}
        {view === "history" && (
          <ExitHistorySection
            teams={teams}
            membersByTeam={membersByTeam}
            exitRequests={exitRequests}
            approvalRequests={approvalRequests}
            staffAccounts={staffAccounts}
            singleCampus={singleCampus}
          />
        )}
      </div>
    </div>
  );
}
