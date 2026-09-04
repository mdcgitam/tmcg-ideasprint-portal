"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { ExitRequestRow, NocRow, ProblemStatementRow, RoomRow, TeamRow, ZoneRow } from "@/types/database";
import type { TeamMemberProfile } from "@/lib/dashboard/admin-data";
import { deleteMember, updateMember, DashboardActionError, type UpdateMemberInput } from "@/lib/dashboard/admin-actions";
import { TeamManagePanel } from "./TeamManagePanel";
import { NocStatus } from "./NocStatus";
import { ExitStatusBadge } from "./ExitStatusBadge";
import { MemberEditForm } from "./TeamFormFields";

/**
 * Full team detail view opened when a team card is clicked in "View by
 * Team" — team-level management (rename/delete/extend/roster) plus a
 * member browser (list on the left, full editable detail incl. NOC on the
 * right), matching the reference team-profile dialog.
 */
export function TeamDetailModal({
  team,
  members,
  room,
  zone,
  ps,
  exitRequests,
  nocs,
  spocName,
  scope,
  onTeamRenamed,
  onTeamDeleted,
  onClose,
}: {
  team: TeamRow;
  members: TeamMemberProfile[];
  room: RoomRow | null;
  zone: ZoneRow | null;
  ps: ProblemStatementRow | null;
  exitRequests: ExitRequestRow[];
  nocs: NocRow[];
  spocName: string | null;
  scope: "spoc" | "admin";
  onTeamRenamed: (teamId: string, name: string) => void;
  onTeamDeleted: (teamId: string) => void;
  onClose: () => void;
}) {
  const [localNocs, setLocalNocs] = useState(nocs);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    members.find((m) => m.is_lead)?.id ?? members[0]?.id ?? null,
  );
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<UpdateMemberInput | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;

  function startEditMember(m: TeamMemberProfile) {
    setEditingMemberId(m.id);
    setMemberError(null);
    setMemberForm({
      name: m.name,
      gitam_email: m.gitam_email,
      phone: m.phone,
      reg_no: m.reg_no,
      year_of_study: m.year_of_study,
      school: m.school,
      department: m.department,
      branch: m.branch,
      gender: m.gender,
      stay: m.stay,
    });
  }

  function cancelEditMember() {
    setEditingMemberId(null);
    setMemberForm(null);
    setMemberError(null);
  }

  async function handleSaveMember(profileId: string) {
    if (!memberForm) return;
    setSavingMember(true);
    setMemberError(null);
    try {
      await updateMember(profileId, memberForm);
      // membersByTeam is server-derived (fetchAdminDashboardData) — reload rather than hand-maintaining a local copy.
      window.location.reload();
    } catch (err) {
      setMemberError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setSavingMember(false);
    }
  }

  async function handleDeleteMember(profileId: string, name: string) {
    if (!window.confirm(`Remove ${name} from their team permanently?`)) return;
    setBusyProfileId(profileId);
    setDeleteError(null);
    try {
      await deleteMember(profileId);
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
      setBusyProfileId(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="font-display text-2xl text-ink">{team.team_name}</h2>
            <p className="mt-1 font-heading text-xs text-ink-muted">
              {team.team_id} · Members: {members.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 font-heading text-xs text-ink-muted transition-colors hover:bg-void"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <TeamManagePanel
            team={team}
            members={members}
            room={room}
            zone={zone}
            ps={ps}
            exitedCount={members.filter((m) => exitRequests.find((r) => r.profile_id === m.id)?.status === "Approved").length}
            spocName={spocName}
            scope={scope}
            onTeamRenamed={onTeamRenamed}
            onTeamDeleted={(teamId) => {
              onClose();
              onTeamDeleted(teamId);
            }}
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    selectedMemberId === m.id ? "border-gold bg-gold/5" : "border-border hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-sm text-ink">
                      {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                    </p>
                    <ExitStatusBadge request={exitRequests.find((r) => r.profile_id === m.id)} />
                  </div>
                  <p className="mt-0.5 font-heading text-xs text-ink-muted">{m.reg_no}</p>
                  <p className="mt-0.5 font-heading text-xs text-ink-muted">{m.gitam_email}</p>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border p-4">
              {!selectedMember ? (
                <p className="font-heading text-sm text-ink-muted">Select a member to see their details.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {deleteError && <p className="font-heading text-xs text-danger">{deleteError}</p>}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-heading text-sm text-ink">
                      {selectedMember.name} {selectedMember.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <ExitStatusBadge request={exitRequests.find((r) => r.profile_id === selectedMember.id)} />
                      {scope === "admin" && (
                        <button
                          type="button"
                          onClick={() =>
                            editingMemberId === selectedMember.id ? cancelEditMember() : startEditMember(selectedMember)
                          }
                          className="text-gold underline"
                        >
                          {editingMemberId === selectedMember.id ? "Cancel" : "Edit"}
                        </button>
                      )}
                      {scope === "admin" && !selectedMember.is_lead && (
                        <button
                          type="button"
                          disabled={busyProfileId === selectedMember.id}
                          onClick={() => handleDeleteMember(selectedMember.id, selectedMember.name)}
                          className="text-danger underline disabled:opacity-60"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">NOC</span>
                    <div className="mt-1">
                      <NocStatus
                        profileId={selectedMember.id}
                        noc={localNocs.find((n) => n.profile_id === selectedMember.id)}
                        onDeleted={() =>
                          setLocalNocs((prev) =>
                            prev.map((n) =>
                              n.profile_id === selectedMember.id ? { ...n, status: "Not Uploaded", file_path: null } : n,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>

                  {editingMemberId === selectedMember.id && memberForm ? (
                    <MemberEditForm
                      form={memberForm}
                      onChange={setMemberForm}
                      onSave={() => handleSaveMember(selectedMember.id)}
                      onCancel={cancelEditMember}
                      saving={savingMember}
                      error={memberError}
                    />
                  ) : (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["User ID", selectedMember.user_id],
                        ["Campus", selectedMember.campus],
                        ["Email", selectedMember.gitam_email],
                        ["Phone", selectedMember.phone],
                        ["Reg./Roll No.", selectedMember.reg_no],
                        ["Year of Study", selectedMember.year_of_study],
                        ["Gender", selectedMember.gender],
                        ["School", selectedMember.school],
                        ["Department", selectedMember.department],
                        ["Branch", selectedMember.branch],
                        ["Stay", selectedMember.stay],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">{label}</dt>
                          <dd className="mt-0.5 font-heading text-sm text-ink">{value || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
