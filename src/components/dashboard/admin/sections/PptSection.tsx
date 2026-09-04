"use client";

import { useState } from "react";
import type { PresentationRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { PresentationStatus } from "./PresentationStatus";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "all" | "missing";

/** Presentation (PPT) tracker, grouped by team. */
export function PptSection({
  teams,
  membersByTeam,
  presentations,
  scope,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  presentations: PresentationRow[];
  scope: "spoc" | "admin";
}) {
  const [localPresentations, setLocalPresentations] = useState(presentations);
  const [view, setView] = useState<View>("all");
  const fadeRef = useTabFade(view);

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          {scope === "admin" ? "No teams registered yet." : "No teams assigned to you yet."}
        </p>
      </div>
    );
  }

  const visibleTeams =
    view === "all"
      ? teams
      : teams.filter((t) => localPresentations.find((p) => p.team_id === t.id)?.status !== "Uploaded");

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "all", label: "All Teams" },
          { value: "missing", label: "Missing Only" },
        ]}
      />

      <div ref={fadeRef} className="flex flex-col gap-3">
        {visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-heading text-sm text-ink-muted">Every team&rsquo;s presentation is uploaded.</p>
          </div>
        ) : (
          visibleTeams.map((team) => {
            const members = membersByTeam[team.id] ?? [];
            const presentation = localPresentations.find((p) => p.team_id === team.id);
            const lead = members.find((m) => m.is_lead);

            return (
              <div
                key={team.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
              >
                <div>
                  <p className="font-heading text-sm text-ink">
                    {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                  </p>
                  <p className="mt-1 font-heading text-xs text-ink-muted">Lead: {lead?.name ?? "—"}</p>
                </div>
                <PresentationStatus
                  teamId={team.id}
                  presentation={presentation}
                  onDeleted={() =>
                    setLocalPresentations((prev) =>
                      prev.map((p) => (p.team_id === team.id ? { ...p, status: "Not Uploaded", file_path: null } : p)),
                    )
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
