"use client";

import { Fragment, useMemo, useState } from "react";
import type { CampusCode, ProfileRow, RoomRow, UserRole, ZoneRow } from "@/types/database";
import {
  createSpoc,
  createCampusAdmin,
  createZoneManager,
  updateStaffProfile,
  reorderStaff,
  deleteSpoc,
  deleteZoneManager,
  deleteCampusAdmin,
  DashboardActionError,
} from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";
import { FilterSelect } from "./TeamFormFields";
import { CAMPUS_ORDER } from "@/lib/dashboard/campus-config";

type NewRole = "SPOC" | "Zone Manager" | "Campus Admin";

const CAMPUSES: CampusCode[] = ["VSP", "HYD", "BLR"];

// Display/sort order everywhere a staff list is shown: Super Admin, Campus Admin, Zone Manager, SPOC.
const ROLE_ORDER: Record<string, number> = { "Super Admin": 0, "Campus Admin": 1, "Zone Manager": 2, SPOC: 3 };
// Groups by campus first (VSP -> HYD -> BLR, Super Admins with no campus first), then by role within each campus.
// Within a group, a row someone has dragged (staff_sort_order set) sorts by that; untouched rows keep falling
// back to their existing relative order (stable sort — created_at desc from the query) and sort after any that
// have been manually placed.
function sortStaff(list: ProfileRow[]): ProfileRow[] {
  const campusRank = (c: CampusCode | null) => (c == null ? -1 : CAMPUS_ORDER.indexOf(c));
  return [...list].sort((a, b) => {
    const campusDiff = campusRank(a.campus) - campusRank(b.campus);
    if (campusDiff !== 0) return campusDiff;
    const roleDiff = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    if (roleDiff !== 0) return roleDiff;
    if (a.staff_sort_order != null && b.staff_sort_order != null) return a.staff_sort_order - b.staff_sort_order;
    if (a.staff_sort_order != null) return -1;
    if (b.staff_sort_order != null) return 1;
    return 0;
  });
}

/** A row can only be dragged among others in the same campus+role bucket. */
function groupKey(s: ProfileRow): string {
  return `${s.campus ?? "none"}::${s.role}`;
}

/**
 * Staff accounts don't go through team registration — this is the only way to
 * create one. A Campus Admin creates SPOCs in their own campus; a Super Admin
 * scoped to one campus module creates for that campus (`campus` prop); a
 * Super Admin viewing "All" (`campus` null) picks the target campus explicitly.
 */
export function StaffAccountsSection({
  campus,
  canManageCampusAdmins = false,
  staffAccounts,
  rooms,
  zones,
}: {
  /** Campus the new account is stamped with. Own campus for a Campus Admin; the active module's campus for the Super Admin; null when the Super Admin is viewing "All". */
  campus: CampusCode | null;
  /** Super Admin only — enables creating Campus Admins and promoting to admin roles. */
  canManageCampusAdmins?: boolean;
  staffAccounts: ProfileRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
}) {
  const [local, setLocal] = useState(staffAccounts);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<NewRole | "">("");
  const [newCampus, setNewCampus] = useState<CampusCode | "">("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [campusFilter, setCampusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("SPOC");
  const [editError, setEditError] = useState<string | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const draggedRow = useMemo(() => (dragId ? (local.find((p) => p.id === dragId) ?? null) : null), [local, dragId]);
  // Reordering reads the group's full membership straight off `visibleStaff` (see handleDrop) — only safe
  // while search can't be hiding some of that group's rows, so dragging is off while a search is typed in.
  const canReorder = search.trim() === "";

  const roleChangeOptions: UserRole[] = canManageCampusAdmins
    ? ["Zone Manager", "SPOC", "Campus Admin"]
    : ["Zone Manager", "SPOC"];

  const canEditOrDelete = (s: ProfileRow) =>
    s.role === "SPOC" || s.role === "Zone Manager" || (s.role === "Campus Admin" && canManageCampusAdmins);

  const roleFilterOptions = useMemo(
    () =>
      Array.from(new Set(local.map((s) => s.role))).sort((a, b) => (ROLE_ORDER[a] ?? 9) - (ROLE_ORDER[b] ?? 9)),
    [local],
  );

  const assignmentOf = (s: ProfileRow): string => {
    if (s.role === "Campus Admin") return s.campus ?? "—";
    if (s.role === "SPOC") {
      const assignedRooms = rooms.filter((r) => r.spoc_profile_id === s.id).map((r) => r.name);
      return assignedRooms.length > 0 ? assignedRooms.join(", ") : "—";
    }
    if (s.role === "Zone Manager") {
      const managedZones = zones.filter((z) => z.zone_manager_profile_id === s.id).map((z) => z.name);
      return managedZones.length > 0 ? managedZones.join(", ") : "—";
    }
    return "—";
  };

  const visibleStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortStaff(
      local.filter((s) => {
        if (campusFilter && s.campus !== campusFilter) return false;
        if (roleFilter && s.role !== roleFilter) return false;
        if (q && !`${s.name} ${s.gitam_email}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    );
  }, [local, campusFilter, roleFilter, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const effectiveCampus = campus ?? (newCampus || null);
    if (!effectiveCampus) {
      setCreateError("Pick a campus first.");
      return;
    }
    if (!role) {
      setCreateError("Pick a role first.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const payload = { name: name.trim(), email: email.trim(), campus: effectiveCampus };
      const id =
        role === "Campus Admin"
          ? await createCampusAdmin(payload)
          : role === "Zone Manager"
            ? await createZoneManager(payload)
            : await createSpoc(payload);
      setLocal((prev) => [
        {
          id,
          auth_user_id: null,
          user_id: "",
          campus: effectiveCampus,
          role,
          name: name.trim(),
          gitam_email: email.trim().toLowerCase(),
          phone: "",
          reg_no: "",
          graduation: null,
          program: null,
          year_of_study: "",
          school: "",
          department: "",
          branch: "",
          gender: "",
          stay: "",
          is_active: true,
          deactivated_at: null,
          staff_sort_order: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setName("");
      setEmail("");
      setNewCampus("");
      setRole("");
    } catch (err) {
      setCreateError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  function handleStartEdit(s: ProfileRow) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditEmail(s.gitam_email);
    setEditRole(s.role);
    setEditError(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(profileId: string) {
    setChangingId(profileId);
    setEditError(null);
    try {
      await updateStaffProfile(profileId, editName, editEmail, editRole);
      setLocal((prev) =>
        prev.map((p) =>
          p.id === profileId ? { ...p, name: editName.trim(), gitam_email: editEmail.trim().toLowerCase(), role: editRole } : p,
        ),
      );
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setChangingId(null);
    }
  }

  async function handleDrop(target: ProfileRow) {
    const draggedId = dragId;
    setDragId(null);
    if (!draggedId || draggedId === target.id) return;
    const dragged = local.find((p) => p.id === draggedId);
    if (!dragged || groupKey(dragged) !== groupKey(target)) return;

    const groupIds = visibleStaff.filter((p) => groupKey(p) === groupKey(target)).map((p) => p.id);
    const fromIdx = groupIds.indexOf(draggedId);
    const toIdx = groupIds.indexOf(target.id);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...groupIds];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);

    const orderById = new Map(reordered.map((id, i) => [id, i]));
    setLocal((prev) => prev.map((p) => (orderById.has(p.id) ? { ...p, staff_sort_order: orderById.get(p.id)! } : p)));
    setRowError(null);
    try {
      await reorderStaff(reordered);
    } catch (err) {
      setRowError(err instanceof DashboardActionError ? err.message : "Something went wrong reordering.");
    }
  }

  async function handleDeleteStaff(s: ProfileRow) {
    const confirmMessage =
      s.role === "Campus Admin"
        ? `Delete Campus Admin ${s.name}?`
        : `Delete ${s.role} ${s.name}? They're unassigned from every ${s.role === "Zone Manager" ? "zone" : "venue"} first.`;
    if (!window.confirm(confirmMessage)) return;
    setChangingId(s.id);
    setRowError(null);
    try {
      await (s.role === "Campus Admin" ? deleteCampusAdmin(s.id) : s.role === "Zone Manager" ? deleteZoneManager(s.id) : deleteSpoc(s.id));
      setLocal((prev) => prev.filter((p) => p.id !== s.id));
    } catch (err) {
      setRowError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">New Staff Account</span>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@student.gitam.edu"
            required
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          {campus == null && (
            <select
              value={newCampus}
              onChange={(e) => setNewCampus(e.target.value as CampusCode | "")}
              required
              className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
            >
              <option value="">Campus…</option>
              {CAMPUSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as NewRole | "")}
            required
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          >
            <option value="">Role…</option>
            {canManageCampusAdmins && <option value="Campus Admin">Campus Admin</option>}
            <option value="Zone Manager">Zone Manager</option>
            <option value="SPOC">SPOC</option>
          </select>
        </div>
        {campus && (
          <p className="mt-2 font-heading text-xs text-ink-faint">New account will be created in <span className="text-gold">{campus}</span>.</p>
        )}
        {createError && <p className="mt-3 font-heading text-sm text-danger">{createError}</p>}
        <button
          type="submit"
          disabled={creating}
          className="mt-4 rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create Account"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {rowError && <p className="font-heading text-sm text-danger">{rowError}</p>}

        {local.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {campus == null && (
              <FilterSelect label="Campus" value={campusFilter} onChange={setCampusFilter} options={CAMPUSES} valueOptions={CAMPUSES} />
            )}
            {roleFilterOptions.length > 1 && (
              <FilterSelect label="Role" value={roleFilter} onChange={setRoleFilter} options={roleFilterOptions} valueOptions={roleFilterOptions} />
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2 font-heading text-sm text-ink outline-none focus:border-gold"
            />
            {!canReorder && (
              <span className="font-heading text-xs text-ink-faint">Clear search to drag-reorder rows.</span>
            )}
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  "staff-accounts",
                  visibleStaff.map((s) => ({
                    Campus: s.campus ?? "—",
                    Name: s.name,
                    Email: s.gitam_email,
                    Role: s.role,
                    Assignment: assignmentOf(s),
                    "User ID": s.user_id,
                  })),
                )
              }
              className="w-fit rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
            >
              Download CSV
            </button>
          </div>
        )}
        {local.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-heading text-sm text-ink-muted">No staff accounts yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Staff</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-heading text-sm">
                <thead>
                  <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                    <th className="w-8 px-2 py-3" />
                    <th className="px-4 py-3">Campus</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Assignment</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibleStaff.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                        No staff match the current filters.
                      </td>
                    </tr>
                  ) : (
                    visibleStaff.map((s) => {
                      const isEditing = editingId === s.id;
                      const draggableRow = canReorder && !isEditing && canEditOrDelete(s);
                      return (
                        <Fragment key={s.id}>
                          <tr
                            className={`border-b border-border align-top last:border-0 ${dragId === s.id ? "opacity-40" : ""}`}
                            onDragOver={(e) => {
                              if (draggedRow && draggedRow.id !== s.id && groupKey(s) === groupKey(draggedRow)) {
                                e.preventDefault();
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              void handleDrop(s);
                            }}
                          >
                            <td className="px-2 py-3 text-center text-ink-faint">
                              {draggableRow && (
                                <span
                                  draggable
                                  onDragStart={(e) => {
                                    setDragId(s.id);
                                    e.dataTransfer.effectAllowed = "move";
                                  }}
                                  onDragEnd={() => setDragId(null)}
                                  title="Drag to reorder within this campus/role group"
                                  className="inline-block cursor-grab select-none px-1 active:cursor-grabbing"
                                >
                                  ⠿
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-ink-muted">{s.campus ?? "—"}</td>
                            <td className="px-4 py-3 text-ink">
                              {isEditing ? (
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full min-w-[140px] rounded-lg border border-border bg-void px-2.5 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                                />
                              ) : (
                                s.name
                              )}
                            </td>
                            <td className="px-4 py-3 text-ink-muted">
                              {isEditing ? (
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  className="w-full min-w-[200px] rounded-lg border border-border bg-void px-2.5 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                                />
                              ) : (
                                s.gitam_email
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                                  className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
                                >
                                  {roleChangeOptions.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                  {!roleChangeOptions.includes(s.role) && (
                                    <option value={s.role} disabled>
                                      {s.role}
                                    </option>
                                  )}
                                </select>
                              ) : (
                                <span className="text-ink">{s.role}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-ink-muted">{assignmentOf(s)}</td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={changingId === s.id}
                                    onClick={() => handleSaveEdit(s.id)}
                                    className="rounded-full bg-gold px-3 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
                                  >
                                    {changingId === s.id ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={changingId === s.id}
                                    onClick={handleCancelEdit}
                                    className="rounded-full border border-border px-3 py-1.5 font-heading text-xs font-medium text-ink-muted transition-colors hover:bg-void disabled:opacity-60"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                canEditOrDelete(s) && (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={changingId === s.id}
                                      onClick={() => handleStartEdit(s)}
                                      className="rounded-full border border-gold/50 px-3 py-1.5 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      disabled={changingId === s.id}
                                      onClick={() => handleDeleteStaff(s)}
                                      className="rounded-full border border-danger/50 px-3 py-1.5 font-heading text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )
                              )}
                            </td>
                          </tr>
                          {isEditing && editError && (
                            <tr className="border-b border-border last:border-0">
                              <td colSpan={7} className="px-4 pb-3 -mt-1 text-sm text-danger">
                                {editError}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
