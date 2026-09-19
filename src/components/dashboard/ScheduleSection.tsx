"use client";

import { useState } from "react";
import type { CampusCode, ProfileRow } from "@/types/database";
import { setConfiguration, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

export interface ScheduleEntry {
  /** ISO datetime (stored UTC, entered/shown in the viewer's local time via <input type="datetime-local">). */
  startsAt: string;
  durationMinutes: number;
  description: string;
  /** null/undefined = shown on every campus's Schedule. A campus code = added by that campus's edit view, shown only there. */
  campus?: CampusCode | null;
}

const SCHEDULE_KEY = "schedule.phase1";
const CAMPUSES: CampusCode[] = ["VSP", "HYD", "BLR"];

export function parseScheduleEntries(config: Record<string, unknown>): ScheduleEntry[] {
  const raw = config[SCHEDULE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is ScheduleEntry => {
      const entry = e as ScheduleEntry;
      return (
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.startsAt === "string" &&
        typeof entry.durationMinutes === "number" &&
        entry.durationMinutes > 0 &&
        typeof entry.description === "string"
      );
    })
    .map((e) => ({ startsAt: e.startsAt, durationMinutes: e.durationMinutes, description: e.description, campus: e.campus ?? null }));
}

function campusView(entries: ScheduleEntry[], campus: CampusCode): ScheduleEntry[] {
  return entries.filter((e) => !e.campus || e.campus === campus);
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function endDate(entry: ScheduleEntry): Date {
  return new Date(new Date(entry.startsAt).getTime() + entry.durationMinutes * 60000);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** "25 Sept, 4:00 pm – 5:40 pm" when the entry fits in one day, else a full start/end stamp. */
function formatRange(entry: ScheduleEntry): string {
  const start = new Date(entry.startsAt);
  const end = endDate(entry);
  if (start.toDateString() === end.toDateString()) {
    return `${start.toLocaleDateString("en-IN", { dateStyle: "medium" })}, ${start.toLocaleTimeString("en-IN", {
      timeStyle: "short",
    })} – ${end.toLocaleTimeString("en-IN", { timeStyle: "short" })}`;
  }
  return `${start.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} – ${end.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

/** Two entries can only ever be seen together if they share a campus, or either one is untagged ("every campus"). */
function scopesOverlap(a: CampusCode | null | undefined, b: CampusCode | null | undefined): boolean {
  return !a || !b || a === b;
}

/** First existing entry (other than `exclude`) whose time range overlaps `candidate` in a scope where both would render together. */
function findOverlap(entries: ScheduleEntry[], candidate: ScheduleEntry, exclude?: ScheduleEntry): ScheduleEntry | null {
  const cStart = new Date(candidate.startsAt).getTime();
  const cEnd = cStart + candidate.durationMinutes * 60000;
  for (const e of entries) {
    if (e === exclude) continue;
    if (!scopesOverlap(candidate.campus, e.campus)) continue;
    const eStart = new Date(e.startsAt).getTime();
    const eEnd = eStart + e.durationMinutes * 60000;
    if (cStart < eEnd && eStart < cEnd) return e;
  }
  return null;
}

function DurationInputs({
  hours,
  minutes,
  onHours,
  onMinutes,
  size = "md",
}: {
  hours: string;
  minutes: string;
  onHours: (v: string) => void;
  onMinutes: (v: string) => void;
  size?: "md" | "sm";
}) {
  const pad = size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm";
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        placeholder="Hrs"
        value={hours}
        onChange={(e) => onHours(e.target.value)}
        className={`w-16 rounded-lg border border-border bg-void font-heading text-ink outline-none focus:border-gold ${pad}`}
      />
      <input
        type="number"
        min={0}
        max={59}
        placeholder="Min"
        value={minutes}
        onChange={(e) => onMinutes(e.target.value)}
        className={`w-16 rounded-lg border border-border bg-void font-heading text-ink outline-none focus:border-gold ${pad}`}
      />
    </div>
  );
}

/** Plain read-only table — the "VSP View"/"HYD View"/"BLR View" tabs, and what every non-managing viewer sees. */
function ReadOnlyTable({ entries }: { entries: ScheduleEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left font-heading text-sm">
        <thead>
          <tr className="border-b border-border bg-gold text-xs text-void uppercase">
            <th className="px-4 py-3">Date &amp; Time</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-4 py-8 text-center text-ink-muted">
                No schedule published yet.
              </td>
            </tr>
          ) : (
            entries.map((entry, i) => (
              <tr key={i} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-ink">
                  {formatRange(entry)}
                  <div className="mt-0.5 font-mono text-[10px] tracking-wide text-ink-faint uppercase">
                    {formatDuration(entry.durationMinutes)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-pre-line text-ink-muted">{entry.description}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Shared by every dashboard (admin/spoc/zone launcher pages and the Team
 * dashboard) — the read-only two-column Date&Time/Action table everyone
 * sees, plus (for Super Admin and Campus Admin) the editing controls.
 *
 * Each entry is a calendar start (date + time) plus a duration, not free
 * text — the displayed range and end time are always derived from those, and
 * two entries that would ever appear together on the same campus view are
 * blocked from overlapping (see findOverlap/scopesOverlap above).
 *
 * Editing scope follows the viewer's current campus, same as the Zones
 * tabs: a Campus Admin, or a Super Admin viewing one campus module, can
 * only add/edit/remove entries tagged to that campus (never the untagged
 * "every campus" rows) and can't reorder — new rows land at the end of the
 * master list. Only a Super Admin viewing "All" sees the full master list,
 * can tag a new row to a specific campus or leave it untagged for
 * everyone, and can reorder any row — plus gets three read-only preview
 * tabs (one per campus) alongside the management view.
 */
export function ScheduleSection({ config, profile }: { config: Record<string, unknown>; profile: ProfileRow }) {
  const canManage = profile.role === "Super Admin" || profile.role === "Campus Admin";
  const isAllMode = profile.role === "Super Admin" && !profile.campus;
  const viewCampus = profile.campus;

  const [entries, setEntries] = useState<ScheduleEntry[]>(() => parseScheduleEntries(config));
  const [newStart, setNewStart] = useState("");
  const [newDurationH, setNewDurationH] = useState("");
  const [newDurationM, setNewDurationM] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCampus, setNewCampus] = useState<CampusCode | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editDurationH, setEditDurationH] = useState("");
  const [editDurationM, setEditDurationM] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  type View = "manage" | CampusCode;
  const [view, setView] = useState<View>("manage");
  const fadeRef = useTabFade(view);

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

  function readDuration(h: string, m: string): number {
    const hours = parseInt(h, 10) || 0;
    const minutes = parseInt(m, 10) || 0;
    return hours * 60 + minutes;
  }

  function handleAdd() {
    const description = newDescription.trim();
    const durationMinutes = readDuration(newDurationH, newDurationM);
    if (!newStart || !description) {
      setError("Enter both a date/time and a description.");
      return;
    }
    if (durationMinutes <= 0) {
      setError("Enter a duration greater than zero.");
      return;
    }
    const campus: CampusCode | null = isAllMode ? newCampus || null : (viewCampus ?? null);
    const candidate: ScheduleEntry = { startsAt: new Date(newStart).toISOString(), durationMinutes, description, campus };
    const conflict = findOverlap(entries, candidate);
    if (conflict) {
      setError(`That overlaps "${conflict.description}" (${formatRange(conflict)}). Adjust the time or duration.`);
      return;
    }
    save([...entries, candidate]);
    setNewStart("");
    setNewDurationH("");
    setNewDurationM("");
    setNewDescription("");
    setNewCampus("");
  }

  function handleRemove(entry: ScheduleEntry) {
    save(entries.filter((e) => e !== entry));
  }

  function handleReorderDrop(targetIndex: number) {
    const fromIndex = dragIndex;
    setDragIndex(null);
    if (fromIndex === null || fromIndex === targetIndex) return;
    const next = [...entries];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);
    save(next);
  }

  function startEdit(entry: ScheduleEntry) {
    setEditingEntry(entry);
    setEditStart(toDatetimeLocal(entry.startsAt));
    setEditDurationH(String(Math.floor(entry.durationMinutes / 60)));
    setEditDurationM(String(entry.durationMinutes % 60));
    setEditDescription(entry.description);
    setError(null);
  }

  function cancelEdit() {
    setEditingEntry(null);
  }

  function handleSaveEdit() {
    if (!editingEntry) return;
    const description = editDescription.trim();
    const durationMinutes = readDuration(editDurationH, editDurationM);
    if (!editStart || !description) {
      setError("Enter both a date/time and a description.");
      return;
    }
    if (durationMinutes <= 0) {
      setError("Enter a duration greater than zero.");
      return;
    }
    const candidate: ScheduleEntry = {
      ...editingEntry,
      startsAt: new Date(editStart).toISOString(),
      durationMinutes,
      description,
    };
    const conflict = findOverlap(entries, candidate, editingEntry);
    if (conflict) {
      setError(`That overlaps "${conflict.description}" (${formatRange(conflict)}). Adjust the time or duration.`);
      return;
    }
    save(entries.map((e) => (e === editingEntry ? candidate : e)));
    setEditingEntry(null);
  }

  const visibleEntries = isAllMode ? entries : entries.filter((e) => !e.campus || e.campus === viewCampus);
  const canEditOrRemove = (entry: ScheduleEntry) => isAllMode || entry.campus === viewCampus;
  const columnCount = 2 + (isAllMode ? 2 : 0) + (canManage ? 1 : 0);

  if (isAllMode && view !== "manage") {
    return (
      <div className="flex flex-col gap-4">
        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            { value: "manage", label: "Create" },
            { value: "VSP", label: "VSP View" },
            { value: "HYD", label: "HYD View" },
            { value: "BLR", label: "BLR View" },
          ]}
        />
        <div ref={fadeRef}>
          <ReadOnlyTable entries={campusView(entries, view)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isAllMode && (
        <ViewToggle
          value={view}
          onChange={setView}
          options={[
            { value: "manage", label: "Create" },
            { value: "VSP", label: "VSP View" },
            { value: "HYD", label: "HYD View" },
            { value: "BLR", label: "BLR View" },
          ]}
        />
      )}

      {canManage && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Add Entry</span>
          {!isAllMode && (
            <p className="mt-1 font-heading text-xs text-ink-muted">
              Added for {viewCampus} only - switch to the &ldquo;All&rdquo; module to add an entry shown on every campus.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-start gap-3">
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
            <input
              type="datetime-local"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
            />
            <DurationInputs hours={newDurationH} minutes={newDurationM} onHours={setNewDurationH} onMinutes={setNewDurationM} />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What happens - one line per detail"
              rows={2}
              className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
            />
            <button
              type="button"
              disabled={saving}
              onClick={handleAdd}
              className="rounded-full bg-gold px-5 py-2 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
          {error && !editingEntry && <p className="mt-2 font-heading text-xs text-danger">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left font-heading text-sm">
          <thead>
            <tr className="border-b border-border bg-gold text-xs text-void uppercase">
              {isAllMode && <th className="w-8 px-2 py-3" />}
              <th className="px-4 py-3">Date &amp; Time</th>
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
              visibleEntries.map((entry, i) => {
                const isEditing = editingEntry === entry;
                const canDragRow = isAllMode && !isEditing;
                return (
                  <tr
                    key={i}
                    className={`border-b border-border align-top last:border-0 ${dragIndex === i ? "opacity-40" : ""}`}
                    onDragOver={(e) => {
                      if (dragIndex !== null && isAllMode) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleReorderDrop(i);
                    }}
                  >
                    {isAllMode && (
                      <td className="px-2 py-3 text-center">
                        {canDragRow && (
                          <span
                            draggable
                            onDragStart={(e) => {
                              setDragIndex(i);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setDragIndex(null)}
                            title="Drag to reorder"
                            className="inline-block cursor-grab select-none px-1 text-ink-faint active:cursor-grabbing"
                          >
                            ⠿
                          </span>
                        )}
                      </td>
                    )}
                    {isEditing ? (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="datetime-local"
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                              className="w-full min-w-[190px] rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                            />
                            <DurationInputs
                              hours={editDurationH}
                              minutes={editDurationM}
                              onHours={setEditDurationH}
                              onMinutes={setEditDurationM}
                              size="sm"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            className="w-full min-w-[220px] rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                          />
                        </td>
                        {isAllMode && <td className="px-4 py-3 text-ink-muted">{entry.campus ?? "All"}</td>}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={handleSaveEdit}
                              className="rounded-full border border-gold/50 px-3 py-1 font-heading text-[11px] font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={cancelEdit}
                              className="text-ink-muted underline disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 whitespace-nowrap text-ink">
                          {formatRange(entry)}
                          <div className="mt-0.5 font-mono text-[10px] tracking-wide text-ink-faint uppercase">
                            {formatDuration(entry.durationMinutes)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-pre-line text-ink-muted">{entry.description}</td>
                        {isAllMode && <td className="px-4 py-3 text-ink-muted">{entry.campus ?? "All"}</td>}
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {canEditOrRemove(entry) && (
                                <>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => startEdit(entry)}
                                    className="text-gold underline disabled:opacity-60"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleRemove(entry)}
                                    className="text-danger underline disabled:opacity-60"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {error && editingEntry && <p className="font-heading text-xs text-danger">{error}</p>}
    </div>
  );
}
