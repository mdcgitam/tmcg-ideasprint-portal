"use client";

import { useState } from "react";
import type { CampusCode, ProfileRow, RoomRow, UserRole, ZoneRow } from "@/types/database";
import {
  createSpoc,
  createCampusAdmin,
  createZoneManager,
  updateUserRole,
  deleteSpoc,
  deleteZoneManager,
  DashboardActionError,
} from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "all" | "by-assignment";
type NewRole = "SPOC" | "Zone Manager" | "Campus Admin";

/**
 * Staff accounts don't go through team registration — this is the only way to
 * create one. A Campus Admin creates SPOCs in their own campus; the global
 * Super Admin creates SPOCs or Campus Admins for the campus module they're in
 * (`campus` prop). Once the person signs in with the matching Google account,
 * auth/callback links the bare `profiles` row exactly like a participant.
 */
export function StaffAccountsSection({
  campus,
  canManageCampusAdmins = false,
  staffAccounts,
  rooms,
  zones,
}: {
  /** Campus the new account is stamped with. Own campus for a Campus Admin; the active module's campus for the Super Admin. */
  campus: CampusCode | null;
  /** Super Admin only — enables creating Campus Admins and promoting to admin roles. */
  canManageCampusAdmins?: boolean;
  staffAccounts: ProfileRow[];
  rooms: RoomRow[];
  zones: ZoneRow[];
}) {
  const singleCampus = campus != null;
  const [local, setLocal] = useState(staffAccounts);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<NewRole>("SPOC");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const fadeRef = useTabFade(view);

  const roleChangeOptions: UserRole[] = canManageCampusAdmins
    ? ["SPOC", "Zone Manager", "Campus Admin"]
    : ["SPOC", "Zone Manager"];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const payload = { name: name.trim(), email: email.trim(), campus };
      const id =
        role === "Campus Admin" && campus
          ? await createCampusAdmin({ ...payload, campus })
          : role === "Zone Manager"
            ? await createZoneManager(payload)
            : await createSpoc(payload);
      setLocal((prev) => [
        { id, auth_user_id: null, user_id: "", campus, role, name: name.trim(), gitam_email: email.trim().toLowerCase(), phone: "", reg_no: "", graduation: null, program: null, year_of_study: "", school: "", department: "", branch: "", gender: "", stay: "", is_active: true, deactivated_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ...prev,
      ]);
      setName("");
      setEmail("");
    } catch (err) {
      setCreateError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(profileId: string, newRole: UserRole) {
    setChangingId(profileId);
    setRowError(null);
    try {
      await updateUserRole(profileId, newRole);
      setLocal((prev) => prev.map((p) => (p.id === profileId ? { ...p, role: newRole } : p)));
    } catch (err) {
      setRowError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setChangingId(null);
    }
  }

  async function handleDeleteStaff(s: ProfileRow) {
    const label = s.role === "Zone Manager" ? "Zone Manager" : "SPOC";
    if (!window.confirm(`Delete ${label} ${s.name}? They're unassigned from every ${s.role === "Zone Manager" ? "zone" : "venue"} first.`)) return;
    setChangingId(s.id);
    setRowError(null);
    try {
      await (s.role === "Zone Manager" ? deleteZoneManager(s.id) : deleteSpoc(s.id));
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
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as NewRole)}
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          >
            <option value="SPOC">SPOC</option>
            <option value="Zone Manager">Zone Manager</option>
            {canManageCampusAdmins && <option value="Campus Admin">Campus Admin</option>}
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
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "staff-accounts",
                local.map((s) => ({
                  Name: s.name,
                  Email: s.gitam_email,
                  ...(singleCampus ? {} : { Campus: s.campus }),
                  Role: s.role,
                  "User ID": s.user_id,
                })),
              )
            }
            className="w-fit rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Download Staff / SPOC List (CSV)
          </button>
        )}
        {local.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-heading text-sm text-ink-muted">No staff accounts yet.</p>
          </div>
        ) : (
          <>
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "View by Staff" },
                { value: "by-assignment", label: "View by Assignment" },
              ]}
            />

            <div ref={fadeRef} className="flex flex-col gap-2">
              {view === "all"
                ? local.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
                    >
                      <div>
                        <p className="font-heading text-sm text-ink">{s.name}</p>
                        <p className="mt-1 font-heading text-xs text-ink-muted">
                          {s.gitam_email}
                          {!singleCampus && ` · ${s.campus}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={s.role}
                          disabled={changingId === s.id}
                          onChange={(e) => handleRoleChange(s.id, e.target.value as UserRole)}
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
                        {(s.role === "SPOC" || s.role === "Zone Manager") && (
                          <button
                            type="button"
                            disabled={changingId === s.id}
                            onClick={() => handleDeleteStaff(s)}
                            className="rounded-full border border-danger/50 px-3 py-1.5 font-heading text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                : local.map((s) => {
                    const assignedRooms = rooms.filter((r) => r.spoc_profile_id === s.id);
                    const managedZones = zones.filter((z) => z.zone_manager_profile_id === s.id);
                    return (
                      <div key={s.id} className="rounded-xl border border-border bg-surface p-4">
                        <p className="font-heading text-sm text-ink">
                          {s.name} <span className="text-ink-faint">· {s.role}</span>
                        </p>
                        <p className="mt-1 font-heading text-xs text-ink-muted">
                          {assignedRooms.length === 0 && managedZones.length === 0
                            ? "No room or zone assignment."
                            : [
                                assignedRooms.length > 0 && `Rooms: ${assignedRooms.map((r) => r.name).join(", ")}`,
                                managedZones.length > 0 && `Zones managed: ${managedZones.map((z) => z.name).join(", ")}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                      </div>
                    );
                  })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
