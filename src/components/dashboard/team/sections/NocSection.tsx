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

/**
 * SPEC §39-48: every participant has an individual NOC. Team Lead can
 * upload/view/replace/delete any member's; a Member can only upload/view
 * their own — never edit/replace/delete it once uploaded.
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

  async function handleUpload(profileId: string, file: File) {
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

        return (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
            <div>
              <p className="font-heading text-sm text-ink">
                {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
              </p>
              <p className={`mt-1 font-heading text-xs ${uploaded ? "text-gitam" : "text-ink-faint"}`}>
                {noc?.status ?? "Not Uploaded"}
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
                    disabled={busy}
                    onClick={() => fileInputRefs.current[m.id]?.click()}
                    className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-60"
                  >
                    {busy ? "Working…" : uploaded ? "Replace" : "Upload"}
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
