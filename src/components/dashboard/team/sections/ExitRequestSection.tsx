"use client";

import { useMemo, useRef, useState } from "react";
import type { ApprovalRequestRow, ExitRequestRow, ProfileRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";
import {
  uploadExitRequestFile,
  deleteExitRequestFile,
  requestMemberExit,
  deleteExitRequest,
  getSignedUrl,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "requests" | "history";

interface HistoryRow {
  id: string;
  type: "Exit" | "Profile Edit";
  requestedByProfileId: string;
  sentAt: string;
  status: "Approved" | "Rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
}

/**
 * Not a mandatory submission — a member requests to exit the event by
 * uploading their signed exit form; a SPOC/Zone Manager/Campus Admin/Super
 * Admin then approves or rejects it. Team Lead can upload/withdraw on
 * behalf of any teammate (mirrors NocSection); a Member can only act on
 * their own. A History tab shows past resolved exit AND profile-edit
 * requests — a Member sees their own exit history plus the team's
 * (team-wide) profile-edit history; a Lead sees everyone's.
 */
export function ExitRequestSection({
  profile,
  teamId,
  members,
  exitRequests,
  approvalRequests,
  isLead,
}: {
  profile: ProfileRow;
  teamId: string;
  members: TeamMemberProfile[];
  exitRequests: ExitRequestRow[];
  approvalRequests: ApprovalRequestRow[];
  isLead: boolean;
}) {
  const [localRequests, setLocalRequests] = useState(exitRequests);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [view, setView] = useState<View>("requests");
  const fadeRef = useTabFade(view);

  const visibleMembers = isLead ? members : members.filter((m) => m.id === profile.id);
  const activeCount = members.filter((m) => m.is_active).length;

  /** Most recent request for this profile (open or resolved) — what's shown as their current status. */
  function currentRequestFor(profileId: string): ExitRequestRow | null {
    const rows = localRequests
      .filter((r) => r.profile_id === profileId)
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
    return rows[0] ?? null;
  }

  function nameOf(profileId: string): string {
    return members.find((m) => m.id === profileId)?.name ?? "Unknown";
  }

  const historyRows: HistoryRow[] = useMemo(() => {
    const visibleIds = new Set(visibleMembers.map((m) => m.id));
    const exitRows: HistoryRow[] = localRequests
      .filter((r): r is ExitRequestRow & { status: "Approved" | "Rejected" } => (r.status === "Approved" || r.status === "Rejected") && visibleIds.has(r.profile_id))
      .map((r) => ({
        id: r.id,
        type: "Exit",
        requestedByProfileId: r.requested_by,
        sentAt: r.requested_at,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
      }));
    // Profile-edit requests are team-wide (not per-member), so everyone sees the full list regardless of isLead.
    const editRows: HistoryRow[] = approvalRequests
      .filter((r): r is ApprovalRequestRow & { status: "Approved" | "Rejected" } => r.status === "Approved" || r.status === "Rejected")
      .map((r) => ({
        id: r.id,
        type: "Profile Edit",
        requestedByProfileId: r.requested_by,
        sentAt: r.created_at,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
      }));
    return [...exitRows, ...editRows].sort(
      (a, b) => new Date(b.reviewedAt ?? b.sentAt).getTime() - new Date(a.reviewedAt ?? a.sentAt).getTime(),
    );
  }, [localRequests, approvalRequests, visibleMembers]);

  async function handleUpload(profileId: string, file: File) {
    setBusyProfileId(profileId);
    setError(null);
    try {
      const path = await uploadExitRequestFile(profileId, file);
      await requestMemberExit(profileId, path, reason[profileId] ?? "");
      setLocalRequests((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          profile_id: profileId,
          team_id: teamId,
          file_path: path,
          status: "Requested",
          reason: reason[profileId] ?? null,
          requested_at: new Date().toISOString(),
          requested_by: profile.id,
          reviewed_by: null,
          reviewed_at: null,
        },
      ]);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleWithdraw(profileId: string) {
    const existing = currentRequestFor(profileId);
    if (!existing?.file_path) return;
    setBusyProfileId(profileId);
    setError(null);
    try {
      await deleteExitRequestFile(existing.file_path);
      await deleteExitRequest(profileId);
      setLocalRequests((prev) => prev.filter((r) => r.id !== existing.id));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleView(filePath: string) {
    const url = await getSignedUrl("exit-requests", filePath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "requests", label: "Requests" },
          { value: "history", label: "History" },
        ]}
      />

      <div ref={fadeRef}>
        {view === "requests" ? (
          <div className="flex flex-col gap-4">
            <p className="max-w-2xl font-heading text-xs text-ink-muted">
              Not a mandatory submission — only for participants who want to exit the event partway through. Upload
              the already-signed, physical exit form; a SPOC, Zone Manager, Campus Admin, or Super Admin will review
              it. A member can exit only while the team keeps at least 3 active members.
            </p>
            {activeCount <= 3 && (
              <p className="max-w-2xl rounded-lg border border-gold/40 bg-gold/5 px-4 py-3 font-heading text-xs text-gold">
                This team is at the 3-member minimum. A single member can&rsquo;t exit on their own — all {activeCount}{" "}
                members must each submit an exit form. Once those are approved the whole team becomes inactive.
              </p>
            )}
            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-heading text-sm text-danger">
                {error}
              </p>
            )}
            {visibleMembers.map((m) => {
              const request = currentRequestFor(m.id);
              const status = request?.status ?? "No Request";
              const busy = busyProfileId === m.id;
              const canAct = isLead || m.id === profile.id;
              const canUpload = canAct && (!request || request.status === "Rejected");
              const canWithdraw = isLead && request?.status === "Requested";

              return (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5 ${
                    m.is_active ? "" : "opacity-60"
                  }`}
                >
                  <div>
                    <p className="font-heading text-sm text-ink">
                      {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
                      {!m.is_active && <span className="ml-1 text-xs text-danger">(Inactive)</span>}
                    </p>
                    <p
                      className={`mt-1 font-heading text-xs ${
                        status === "Approved" ? "text-danger" : status === "Requested" ? "text-gold" : "text-ink-faint"
                      }`}
                    >
                      {status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {request?.file_path && (
                      <button type="button" onClick={() => handleView(request.file_path!)} className="font-heading text-sm text-gold underline">
                        View
                      </button>
                    )}
                    {canUpload && (
                      <>
                        <input
                          value={reason[m.id] ?? ""}
                          onChange={(e) => setReason((r) => ({ ...r, [m.id]: e.target.value }))}
                          placeholder="Reason (optional)"
                          className="w-40 rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold"
                        />
                        <input
                          ref={(el) => {
                            fileInputRefs.current[m.id] = el;
                          }}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(m.id, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => fileInputRefs.current[m.id]?.click()}
                          className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-60"
                        >
                          {busy ? "Working…" : "Request Exit"}
                        </button>
                      </>
                    )}
                    {canWithdraw && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleWithdraw(m.id)}
                        className="rounded-full border border-danger/40 px-4 py-1.5 font-heading text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {historyRows.length === 0 ? (
              <p className="p-8 text-center font-heading text-sm text-ink-muted">No resolved requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-heading text-sm">
                  <thead>
                    <tr className="border-b border-border bg-gold text-xs text-void uppercase">
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Requested By</th>
                      <th className="px-4 py-3">Sent At</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reviewed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((r) => (
                      <tr key={`${r.type}-${r.id}`} className="border-b border-border align-top last:border-0">
                        <td className="px-4 py-3 text-ink-muted">{r.type}</td>
                        <td className="px-4 py-3 text-ink">{nameOf(r.requestedByProfileId)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                          {new Date(r.sentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs ${
                              r.status === "Approved" ? "border-gitam/40 bg-gitam/10 text-gitam" : "border-danger/40 bg-danger/10 text-danger"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                          {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
