"use client";

import { useState } from "react";
import type { ProblemStatementRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { changeTeamLead, deleteTeam, updateTeamName, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";

/** The "Manage Team" panel — rename, delete, change lead, roster CSV. Shared by TeamsByTeamView and TeamsByMembersView so both views reuse one implementation. */
export function TeamManagePanel({
  team,
  members,
  room,
  zone,
  ps,
  exitedCount,
  spocName,
  scope,
  onTeamRenamed,
  onTeamDeleted,
}: {
  team: TeamRow;
  members: TeamMemberProfile[];
  room: RoomRow | null;
  zone: ZoneRow | null;
  ps: ProblemStatementRow | null;
  exitedCount: number;
  spocName: string | null;
  scope: "spoc" | "admin";
  onTeamRenamed: (teamId: string, name: string) => void;
  onTeamDeleted: (teamId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [teamNameDraft, setTeamNameDraft] = useState(team.team_name);
  const [savingTeamName, setSavingTeamName] = useState(false);
  const [teamNameError, setTeamNameError] = useState<string | null>(null);

  const lead = members.find((m) => m.is_lead);
  const otherMembers = members.filter((m) => !m.is_lead);
  const [newLeadId, setNewLeadId] = useState(otherMembers[0]?.id ?? "");
  const [changingLead, setChangingLead] = useState(false);
  const [changeLeadError, setChangeLeadError] = useState<string | null>(null);

  function handleDownloadTeam() {
    downloadCsv(
      `${team.team_name}-roster`,
      members.map((m) => ({
        "Member Name": m.name,
        "Reg./Roll No.": m.reg_no,
        "Year of Study": m.year_of_study,
        "Team Name": team.team_name,
        "Team Lead": lead?.name ?? "—",
        SPOC: spocName ?? "Unassigned",
        "Room Number": room?.name ?? "Unassigned",
      })),
    );
  }

  async function handleDeleteTeam() {
    if (!window.confirm(`Delete "${team.team_name}" and every member permanently? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTeam(team.id);
      onTeamDeleted(team.id);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function handleSaveTeamName() {
    if (!teamNameDraft.trim()) return;
    setSavingTeamName(true);
    setTeamNameError(null);
    try {
      await updateTeamName(team.id, teamNameDraft.trim());
      onTeamRenamed(team.id, teamNameDraft.trim());
      setEditingName(false);
    } catch (err) {
      setTeamNameError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSavingTeamName(false);
    }
  }

  async function handleChangeLead() {
    if (!newLeadId) return;
    const target = otherMembers.find((m) => m.id === newLeadId);
    if (!target || !window.confirm(`Make ${target.name} the Team Lead? ${lead?.name ?? "The current lead"} becomes a Member.`)) {
      return;
    }
    setChangingLead(true);
    setChangeLeadError(null);
    try {
      await changeTeamLead(team.id, newLeadId);
      // is_lead/role changes are server-derived (fetchAdminDashboardData) — reload rather than hand-maintaining a local copy.
      window.location.reload();
    } catch (err) {
      setChangeLeadError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setChangingLead(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="font-heading text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadTeam}
          className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
        >
          Download Roster (CSV)
        </button>
        {scope === "admin" && (
          <>
            <button
              type="button"
              onClick={() => setEditingName((v) => !v)}
              className="rounded-full border border-gold/50 px-4 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
            >
              {editingName ? "Cancel Rename" : "Rename Team"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDeleteTeam}
              className="rounded-full border border-danger/50 px-4 py-1.5 font-heading text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
            >
              Delete Team
            </button>
          </>
        )}
      </div>

      {scope === "admin" && editingName && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gold/30 p-3">
          <input
            value={teamNameDraft}
            onChange={(e) => setTeamNameDraft(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingTeamName || !teamNameDraft.trim()}
            onClick={handleSaveTeamName}
            className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {savingTeamName ? "Saving…" : "Save"}
          </button>
          {teamNameError && <p className="w-full font-heading text-xs text-danger">{teamNameError}</p>}
        </div>
      )}

      <p className="font-heading text-xs text-ink-muted">
        Status: {team.status} · {exitedCount > 0 ? `${exitedCount} of ${members.length} Exited` : "All Active"}
      </p>

      <p className="font-heading text-xs text-ink-muted">
        Room: {room?.name ?? "Unassigned"} {zone && `· Zone: ${zone.name}`} · SPOC: {spocName ?? "Unassigned"}
        {scope === "admin" && <span className="text-ink-faint"> — change this from Rooms & Zones</span>}
      </p>

      {ps && (
        <p className="font-heading text-xs text-ink-muted">
          Problem Statement: {ps.number} — {ps.title}
        </p>
      )}

      {scope === "admin" && (
        <div className="rounded-lg border border-border p-3">
          <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Change Team Lead</span>
          <p className="mt-1 font-heading text-xs text-ink-muted">
            Current Lead: {lead?.name ?? "Unassigned"}
          </p>
          {otherMembers.length === 0 ? (
            <p className="mt-2 font-heading text-xs text-ink-faint">No other members to promote.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={newLeadId}
                onChange={(e) => setNewLeadId(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
              >
                {otherMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.reg_no})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={changingLead || !newLeadId}
                onClick={handleChangeLead}
                className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
              >
                {changingLead ? "Changing…" : "Make Lead"}
              </button>
            </div>
          )}
          {changeLeadError && <p className="mt-2 font-heading text-xs text-danger">{changeLeadError}</p>}
        </div>
      )}
    </div>
  );
}
