"use client";

import { useRef, useState } from "react";
import type { NocRow, ProfileRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";
import {
  uploadNocFile,
  deleteNocFile,
  recordNocMetadata,
  deleteNoc,
  getSignedUrl,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * SPEC §39-48: every participant has an individual NOC. Team Lead can
 * upload/view/replace/delete any member's; a Member can only upload/view
 * their own — never edit/replace/delete it once uploaded. Files must be a
 * PDF under 2MB (matches the noc-uploads storage bucket's
 * file_size_limit/allowed_mime_types).
 */
export function NocSection({
  profile,
  members,
  nocs,
  isLead,
}: {
  profile: ProfileRow;
  members: TeamMemberProfile[];
  nocs: NocRow[];
  isLead: boolean;
}) {
  const [localNocs, setLocalNocs] = useState(nocs);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const visibleMembers = isLead ? members : members.filter((m) => m.id === profile.id);

  function nocFor(profileId: string) {
    return localNocs.find((n) => n.profile_id === profileId) ?? null;
  }

  function deadlinePassed(profileId: string): boolean {
    const deadline = nocFor(profileId)?.deadline;
    return !!deadline && new Date(deadline) < new Date();
  }

  async function handleUpload(profileId: string, file: File) {
    if (deadlinePassed(profileId)) {
      setError("Time exceeded — the upload deadline has passed. Ask your SPOC or Super Admin to extend it.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds the 2MB limit.");
      return;
    }
    setBusyProfileId(profileId);
    setError(null);
    try {
      const path = await uploadNocFile(profileId, file);
      await recordNocMetadata(profileId, path);
      setLocalNocs((prev) => {
        const existing = prev.find((n) => n.profile_id === profileId);
        const updated: NocRow = {
          id: existing?.id ?? crypto.randomUUID(),
          profile_id: profileId,
          file_path: path,
          status: "Uploaded",
          uploaded_by: profile.id,
          uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deadline: existing?.deadline ?? null,
        };
        return existing ? prev.map((n) => (n.profile_id === profileId ? updated : n)) : [...prev, updated];
      });
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleDelete(profileId: string) {
    const existing = nocFor(profileId);
    if (!existing?.file_path) return;
    setBusyProfileId(profileId);
    setError(null);
    try {
      await deleteNocFile(existing.file_path);
      await deleteNoc(profileId);
      setLocalNocs((prev) =>
        prev.map((n) => (n.profile_id === profileId ? { ...n, status: "Not Uploaded", file_path: null } : n)),
      );
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleView(profileId: string) {
    const existing = nocFor(profileId);
    if (!existing?.file_path) return;
    const url = await getSignedUrl("noc-uploads", existing.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading text-xs text-ink-muted">NOC files must be a PDF under 2MB.</p>
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-heading text-sm text-danger">
          {error}
        </p>
      )}
      {visibleMembers.map((m) => {
        const noc = nocFor(m.id);
        const uploaded = noc?.status === "Uploaded" && noc.file_path;
        const canManage = isLead; // Team Lead: upload/replace/delete any; Member: upload own only, no replace/delete.
        const canUpload = canManage || (m.id === profile.id && !uploaded);
        const busy = busyProfileId === m.id;
        const expired = deadlinePassed(m.id);

        return (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
            <div>
              <p className="font-heading text-sm text-ink">
                {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
              </p>
              <p className={`mt-1 font-heading text-xs ${uploaded ? "text-gitam" : "text-ink-faint"}`}>
                {noc?.status ?? "Not Uploaded"}
              </p>
              <p className={`mt-1 font-heading text-xs ${expired ? "text-danger" : "text-ink-faint"}`}>
                Deadline:{" "}
                {noc?.deadline
                  ? new Date(noc.deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                  : "Not set"}
                {expired && " — Time exceeded"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {uploaded && (
                <button
                  type="button"
                  onClick={() => handleView(m.id)}
                  className="font-heading text-sm text-gold underline"
                >
                  View
                </button>
              )}
              {canUpload && (
                <>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[m.id] = el;
                    }}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(m.id, file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || expired}
                    onClick={() => fileInputRefs.current[m.id]?.click()}
                    title={expired ? "Deadline passed — ask your SPOC or Super Admin to extend it." : undefined}
                    className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-60"
                  >
                    {busy ? "Working…" : expired ? "Time Exceeded" : uploaded ? "Replace" : "Upload"}
                  </button>
                </>
              )}
              {canManage && uploaded && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(m.id)}
                  className="rounded-full border border-danger/40 px-4 py-1.5 font-heading text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
