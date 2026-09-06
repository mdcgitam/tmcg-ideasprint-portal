"use client";

import { useRef, useState } from "react";
import type { ExitRequestRow, ProfileRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";
import {
  uploadExitRequestFile,
  deleteExitRequestFile,
  requestMemberExit,
  deleteExitRequest,
  getSignedUrl,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";

/**
 * Not a mandatory submission — a member requests to exit the event by
 * uploading their signed exit form; a SPOC/Super Admin then approves or
 * rejects it from the Approvals queue. Team Lead can upload/withdraw on
 * behalf of any teammate (mirrors NocSection); a Member can only act on
 * their own.
 */
export function ExitRequestSection({
  profile,
  members,
  exitRequests,
  isLead,
}: {
  profile: ProfileRow;
  members: TeamMemberProfile[];
  exitRequests: ExitRequestRow[];
  isLead: boolean;
}) {
  const [localRequests, setLocalRequests] = useState(exitRequests);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const visibleMembers = isLead ? members : members.filter((m) => m.id === profile.id);

  function requestFor(profileId: string) {
    return localRequests.find((r) => r.profile_id === profileId) ?? null;
  }

  async function handleUpload(profileId: string, file: File) {
    setBusyProfileId(profileId);
    setError(null);
    try {
      const path = await uploadExitRequestFile(profileId, file);
      await requestMemberExit(profileId, path, reason[profileId] ?? "");
      setLocalRequests((prev) => {
        const existing = prev.find((r) => r.profile_id === profileId);
        const updated: ExitRequestRow = {
          id: existing?.id ?? crypto.randomUUID(),
          profile_id: profileId,
          team_id: existing?.team_id ?? "",
          file_path: path,
          status: "Requested",
          reason: reason[profileId] ?? null,
          requested_at: new Date().toISOString(),
          reviewed_by: null,
          reviewed_at: null,
        };
        return existing ? prev.map((r) => (r.profile_id === profileId ? updated : r)) : [...prev, updated];
      });
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleWithdraw(profileId: string) {
    const existing = requestFor(profileId);
    if (!existing?.file_path) return;
    setBusyProfileId(profileId);
    setError(null);
    try {
      await deleteExitRequestFile(existing.file_path);
      await deleteExitRequest(profileId);
      setLocalRequests((prev) => prev.filter((r) => r.profile_id !== profileId));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleView(profileId: string) {
    const existing = requestFor(profileId);
    if (!existing?.file_path) return;
    const url = await getSignedUrl("exit-requests", existing.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl font-heading text-xs text-ink-muted">
        Not a mandatory submission — only for participants who want to exit the event partway through. Upload the
        already-signed, physical exit form; a SPOC or Super Admin will review it.
      </p>
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-heading text-sm text-danger">
          {error}
        </p>
      )}
      {visibleMembers.map((m) => {
        const request = requestFor(m.id);
        const status = request?.status ?? "No Request";
        const busy = busyProfileId === m.id;
        const canAct = isLead || m.id === profile.id;
        const canUpload = canAct && (!request || request.status === "Rejected");
        const canWithdraw = isLead && request?.status === "Requested";

        return (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
            <div>
              <p className="font-heading text-sm text-ink">
                {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
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
                <button type="button" onClick={() => handleView(m.id)} className="font-heading text-sm text-gold underline">
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
  );
}
