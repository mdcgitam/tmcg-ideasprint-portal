"use client";

import { useState } from "react";
import type { ExitFormRow, ProblemStatementRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import {
  extendProblemStatementDeadline,
  deleteTeam,
  updateTeamName,
  DashboardActionError,
} from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";

/** The "Manage Team" panel — rename, delete, extend PS deadline, roster CSV. Shared by TeamsByTeamView and TeamsByMembersView so both views reuse one implementation. */
export function TeamManagePanel({
  team,
  members,
  room,
  zone,
  ps,
  exitForm,
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
  exitForm: ExitFormRow | undefined;
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

  const [extendUntil, setExtendUntil] = useState("");
  const [extendReason, setExtendReason] = useState("");
  const [extending, setExtending] = useState(false);
  const [extendMessage, setExtendMessage] = useState("");

  function handleDownloadTeam() {
    const lead = members.find((m) => m.is_lead);
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

  async function handleExtend() {
    if (!extendUntil) return;
    setExtending(true);
    setExtendMessage("");
    try {
      await extendProblemStatementDeadline(team.id, new Date(extendUntil).toISOString(), extendReason);
      setExtendMessage("Deadline extended.");
    } catch (err) {
      setExtendMessage(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setExtending(false);
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
        Status: {team.status} · Exit Form: {exitForm?.status ?? "Not Submitted"}
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

      <div className="rounded-lg border border-border p-3">
        <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Extend PS Selection Deadline</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={extendUntil}
            onChange={(e) => setExtendUntil(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={extendReason}
            onChange={(e) => setExtendReason(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={extending || !extendUntil}
            onClick={handleExtend}
            className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {extending ? "Extending…" : "Extend"}
          </button>
        </div>
        {extendMessage && <p className="mt-2 font-heading text-xs text-ink-muted">{extendMessage}</p>}
      </div>
    </div>
  );
}
