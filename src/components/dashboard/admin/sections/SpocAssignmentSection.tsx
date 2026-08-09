"use client";

import { useState } from "react";
import type { TeamRow, ProfileRow } from "@/types/database";
import { assignSpoc, DashboardActionError } from "@/lib/dashboard/admin-actions";

/**
 * Pick a SPOC, see every team as a checkbox, check/uncheck to assign or
 * unassign that team to the selected SPOC, one "Save" applies the diff —
 * bulk-oriented, as opposed to TeamsListSection's per-team read-only view.
 */
export function SpocAssignmentSection({ teams, spocs }: { teams: TeamRow[]; spocs: ProfileRow[] }) {
  const [localTeams, setLocalTeams] = useState(teams);
  const [selectedSpocId, setSelectedSpocId] = useState(spocs[0]?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(teams.filter((t) => t.spoc_profile_id === spocs[0]?.id).map((t) => t.id)),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectSpoc(spocId: string) {
    setSelectedSpocId(spocId);
    setChecked(new Set(localTeams.filter((t) => t.spoc_profile_id === spocId).map((t) => t.id)));
    setMessage(null);
    setError(null);
  }

  function toggle(teamId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const originallyAssigned = new Set(localTeams.filter((t) => t.spoc_profile_id === selectedSpocId).map((t) => t.id));
      const toAssign = [...checked].filter((id) => !originallyAssigned.has(id));
      const toUnassign = [...originallyAssigned].filter((id) => !checked.has(id));

      for (const teamId of toAssign) await assignSpoc(teamId, selectedSpocId);
      for (const teamId of toUnassign) await assignSpoc(teamId, null);

      setLocalTeams((prev) =>
        prev.map((t) => {
          if (toAssign.includes(t.id)) return { ...t, spoc_profile_id: selectedSpocId };
          if (toUnassign.includes(t.id)) return { ...t, spoc_profile_id: null };
          return t;
        }),
      );
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (spocs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">
          No SPOC accounts yet — promote a registered user to the SPOC role first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">SPOC</span>
        <select
          value={selectedSpocId}
          onChange={(e) => selectSpoc(e.target.value)}
          className="mt-3 w-full rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold sm:w-auto"
        >
          {spocs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.user_id})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Assigned Teams</span>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {localTeams.map((team) => (
            <label
              key={team.id}
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 font-heading text-sm text-ink"
            >
              <input
                type="checkbox"
                checked={checked.has(team.id)}
                onChange={() => toggle(team.id)}
                className="size-4 accent-gold"
              />
              {team.team_name}
              {team.spoc_profile_id && team.spoc_profile_id !== selectedSpocId && (
                <span className="ml-auto text-xs text-ink-faint">
                  currently: {spocs.find((s) => s.id === team.spoc_profile_id)?.name ?? "another SPOC"}
                </span>
              )}
            </label>
          ))}
        </div>

        {error && <p className="mt-3 font-heading text-sm text-danger">{error}</p>}
        {message && <p className="mt-3 font-heading text-sm text-gitam">{message}</p>}

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="mt-4 rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
