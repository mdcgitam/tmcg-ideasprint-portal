"use client";

import { useState } from "react";
import type { NocRow, PresentationRow, TeamRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { NocStatus } from "./NocStatus";
import { PresentationStatus } from "./PresentationStatus";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "all" | "missing";

/** Combined NOC + Presentation (PPT) tracker, grouped by team. */
export function NocPptSection({
  teams,
  membersByTeam,
  nocs,
  presentations,
  scope,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  nocs: NocRow[];
  presentations: PresentationRow[];
  scope: "spoc" | "admin";
}) {
  const [localNocs, setLocalNocs] = useState(nocs);
  const [localPresentations, setLocalPresentations] = useState(presentations);
  const [view, setView] = useState<View>("all");
  const fadeRef = useTabFade(view);

  function isTeamComplete(team: TeamRow) {
    const members = membersByTeam[team.id] ?? [];
    const allNocsUploaded = members.every((m) => localNocs.find((n) => n.profile_id === m.id)?.status === "Uploaded");
    const pptUploaded = localPresentations.find((p) => p.team_id === team.id)?.status === "Uploaded";
    return allNocsUploaded && pptUploaded;
  }

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          {scope === "admin" ? "No teams registered yet." : "No teams assigned to you yet."}
        </p>
      </div>
    );
  }

  const visibleTeams = view === "all" ? teams : teams.filter((t) => !isTeamComplete(t));

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

      <div ref={fadeRef} className="flex flex-col gap-4">
        {visibleTeams.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-heading text-sm text-ink-muted">Every team&rsquo;s NOCs and PPT are uploaded.</p>
          </div>
        ) : (
          visibleTeams.map((team) => {
            const members = membersByTeam[team.id] ?? [];
            const presentation = localPresentations.find((p) => p.team_id === team.id);

            return (
              <div key={team.id} className="rounded-xl border border-border bg-surface p-5">
                <p className="font-heading text-sm text-ink">
                  {team.team_name} <span className="text-ink-faint">· {team.team_id}</span>
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                    >
                      <span className="font-heading text-ink-muted">
                        {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                      </span>
                      <NocStatus
                        profileId={m.id}
                        noc={localNocs.find((n) => n.profile_id === m.id)}
                        onDeleted={() =>
                          setLocalNocs((prev) =>
                            prev.map((n) =>
                              n.profile_id === m.id ? { ...n, status: "Not Uploaded", file_path: null } : n,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <span className="font-mono text-xs tracking-[0.2em] text-gold uppercase">PPT</span>
                  <PresentationStatus
                    teamId={team.id}
                    presentation={presentation}
                    onDeleted={() =>
                      setLocalPresentations((prev) =>
                        prev.map((p) =>
                          p.team_id === team.id ? { ...p, status: "Not Uploaded", file_path: null } : p,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
