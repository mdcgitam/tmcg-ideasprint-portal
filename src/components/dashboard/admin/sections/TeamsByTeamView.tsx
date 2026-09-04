"use client";

import { useState } from "react";
import type { ExitFormRow, NocRow, ProblemStatementRow, ProfileRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { TeamDetailModal } from "./TeamDetailModal";

/** "View by Team" — a card per team (Team ID / Name / Lead / Problem Statement); clicking opens the full team detail view. */
export function TeamsByTeamView({
  teams,
  membersByTeam,
  problemStatements,
  rooms,
  zones,
  staffAccounts,
  exitForms,
  nocs,
  scope,
  onTeamRenamed,
  onTeamDeleted,
}: {
  teams: TeamRow[];
  membersByTeam: Record<string, TeamMemberProfile[]>;
  problemStatements: ProblemStatementRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
  staffAccounts: ProfileRow[];
  exitForms: ExitFormRow[];
  nocs: NocRow[];
  scope: "spoc" | "admin";
  onTeamRenamed: (teamId: string, name: string) => void;
  onTeamDeleted: (teamId: string) => void;
}) {
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  const spocName = (id: string | null) => staffAccounts.find((s) => s.id === id)?.name ?? null;
  const roomOf = (team: TeamRow) => rooms.find((r) => r.id === team.room_id) ?? null;
  const zoneOf = (room: RoomRow | null) => (room ? (zones.find((z) => z.id === room.zone_id) ?? null) : null);
  const psOf = (team: TeamRow) => problemStatements.find((p) => p.id === team.current_problem_statement_id) ?? null;

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          {scope === "admin" ? "No teams registered yet." : "No teams assigned to you yet."}
        </p>
      </div>
    );
  }

  const openTeam = teams.find((t) => t.id === openTeamId) ?? null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => {
        const members = membersByTeam[team.id] ?? [];
        const lead = members.find((m) => m.is_lead);
        const ps = psOf(team);

        return (
          <button
            key={team.id}
            type="button"
            onClick={() => setOpenTeamId(team.id)}
            className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-gold/40"
          >
            <p className="font-mono text-xs text-ink-faint">{team.team_id}</p>
            <p className="mt-1 font-heading text-sm text-ink">{team.team_name}</p>
            <p className="mt-1 font-heading text-xs text-ink-muted">Lead: {lead?.name ?? "—"}</p>
            <p className="mt-1 font-heading text-xs text-ink-muted">
              {ps ? `PS: ${ps.number} — ${ps.title}` : "No problem statement selected"}
            </p>
          </button>
        );
      })}

      {openTeam && (
        <TeamDetailModal
          team={openTeam}
          members={membersByTeam[openTeam.id] ?? []}
          room={roomOf(openTeam)}
          zone={zoneOf(roomOf(openTeam))}
          ps={psOf(openTeam)}
          exitForm={exitForms.find((e) => e.team_id === openTeam.id)}
          nocs={nocs}
          spocName={spocName(openTeam.spoc_profile_id)}
          scope={scope}
          onTeamRenamed={onTeamRenamed}
          onTeamDeleted={(teamId) => {
            setOpenTeamId(null);
            onTeamDeleted(teamId);
          }}
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </div>
  );
}
