"use client";

import { useState } from "react";
import type { CampusCode, ProfileRow } from "@/types/database";
import { setConfiguration, DashboardActionError } from "@/lib/dashboard/admin-actions";

export interface ScheduleEntry {
  time: string;
  description: string;
  /** null/undefined = shown on every campus's Schedule. A campus code = added by that campus's edit view, shown only there. */
  campus?: CampusCode | null;
}

const SCHEDULE_KEY = "schedule.phase1";
const CAMPUSES: CampusCode[] = ["VSP", "BLR", "HYD"];

export function parseScheduleEntries(config: Record<string, unknown>): ScheduleEntry[] {
  const raw = config[SCHEDULE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is ScheduleEntry =>
        typeof e === "object" && e !== null && typeof (e as ScheduleEntry).time === "string" && typeof (e as ScheduleEntry).description === "string",
    )
    .map((e) => ({ time: e.time, description: e.description, campus: e.campus ?? null }));
}

/**
 * Shared by every dashboard (admin/spoc/zone launcher pages and the Team
 * dashboard) — the read-only two-column Time/Action table everyone sees,
 * plus (for Super Admin and Campus Admin) the editing controls.
 *
 * Editing scope follows the viewer's current campus, same as the Zones
 * tabs: a Campus Admin, or a Super Admin viewing one campus module, can
 * only add/remove entries tagged to that campus (never the untagged
 * "every campus" rows) and can't reorder — new rows land at the end of the
 * master list. Only a Super Admin viewing "All" sees the full master list,
 * can tag a new row to a specific campus or leave it untagged for
 * everyone, and can reorder any row.
 */
export function ScheduleSection({ config, profile }: { config: Record<string, unknown>; profile: ProfileRow }) {
  const canManage = profile.role === "Super Admin" || profile.role === "Campus Admin";
  const isAllMode = profile.role === "Super Admin" && !profile.campus;
  const viewCampus = profile.campus;

  const [entries, setEntries] = useState<ScheduleEntry[]>(() => parseScheduleEntries(config));
  const [newTime, setNewTime] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCampus, setNewCampus] = useState<CampusCode | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: ScheduleEntry[]) {
    setSaving(true);
    setError(null);
    try {
      await setConfiguration(SCHEDULE_KEY, next, "Event schedule shown in the Schedule module.");
      setEntries(next);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    const time = newTime.trim();
    const description = newDescription.trim();
    if (!time || !description) {
      setError("Enter both a time and a description.");
      return;
    }
    const campus: CampusCode | null = isAllMode ? newCampus || null : (viewCampus ?? null);
    save([...entries, { time, description, campus }]);
    setNewTime("");
    setNewDescription("");
    setNewCampus("");
  }

  function handleRemove(entry: ScheduleEntry) {
    save(entries.filter((e) => e !== entry));
  }

  function handleMove(entry: ScheduleEntry, direction: -1 | 1) {
    const index = entries.indexOf(entry);
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  }

  const visibleEntries = isAllMode ? entries : entries.filter((e) => !e.campus || e.campus === viewCampus);
  const canRemove = (entry: ScheduleEntry) => isAllMode || entry.campus === viewCampus;
  const columnCount = 2 + (isAllMode ? 1 : 0) + (canManage ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Add Entry</span>
          {!isAllMode && (
            <p className="mt-1 font-heading text-xs text-ink-muted">
              Added for {viewCampus} only — switch to the &ldquo;All&rdquo; module to add an entry shown on every campus.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              placeholder="e.g. 25th Sep, 04:00 PM"
              className="min-w-[180px] rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What happens — one line per detail"
              rows={2}
              className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
            />
            {isAllMode && (
              <select
                value={newCampus}
                onChange={(e) => setNewCampus(e.target.value as CampusCode | "")}
                className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
              >
                <option value="">All Campuses</option>
                {CAMPUSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleAdd}
              className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
          {error && <p className="mt-2 font-heading text-xs text-danger">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left font-heading text-sm">
          <thead>
            <tr className="border-b border-border bg-gold text-xs text-void uppercase">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
              {isAllMode && <th className="px-4 py-3">Campus</th>}
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {visibleEntries.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-8 text-center text-ink-muted">
                  No schedule published yet.
                </td>
              </tr>
            ) : (
              visibleEntries.map((entry, i) => (
                <tr key={i} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{entry.time}</td>
                  <td className="px-4 py-3 whitespace-pre-line text-ink-muted">{entry.description}</td>
                  {isAllMode && <td className="px-4 py-3 text-ink-muted">{entry.campus ?? "All"}</td>}
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isAllMode && (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleMove(entry, -1)}
                              className="rounded border border-border px-2 py-1 text-xs text-ink-muted hover:border-gold hover:text-gold disabled:opacity-60"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleMove(entry, 1)}
                              className="rounded border border-border px-2 py-1 text-xs text-ink-muted hover:border-gold hover:text-gold disabled:opacity-60"
                            >
                              ↓
                            </button>
                          </>
                        )}
                        {canRemove(entry) && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleRemove(entry)}
                            className="text-danger underline disabled:opacity-60"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
