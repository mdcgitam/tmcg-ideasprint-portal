"use client";

import { useRef, useState } from "react";
import type { CampusCode, NocRow, ProfileRow } from "@/types/database";
import type { TeamMemberProfile } from "../TeamDashboardShell";
import {
  uploadNocFile,
  deleteNocFile,
  recordNocMetadata,
  deleteNoc,
  getSignedUrl,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";
import { effectiveNocDeadline } from "@/lib/dashboard/campus-config";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * SPEC §39-48: every participant has an individual NOC. Team Lead can
 * view/replace/delete any member's; a Member can do the same for their own
 * — both right up until the deadline (0063). Files must be a PDF under
 * 2MB (matches the noc-uploads storage bucket's
 * file_size_limit/allowed_mime_types). A per-member deadline override
 * (set from the admin NOC page) wins over the campus-scoped General NOC
 * Deadline set in Configuration; uploads are locked until one of those
 * exists at all — not just once it's passed (record_noc_metadata, 0062).
 */
export function NocSection({
  profile,
  members,
  nocs,
  config,
  isLead,
}: {
  profile: ProfileRow;
  members: TeamMemberProfile[];
  nocs: NocRow[];
  config: Record<string, unknown>;
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

  function effectiveDeadlineFor(profileId: string, campus: CampusCode | null): string | null {
    const noc = nocFor(profileId);
    return effectiveNocDeadline(config, campus, noc?.deadline, noc?.deadline_updated_at);
  }

  async function handleUpload(profileId: string, campus: CampusCode | null, file: File) {
    const deadline = effectiveDeadlineFor(profileId, campus);
    if (!deadline) {
      setError("No deadline has been set yet — ask your SPOC, Zone Manager, Campus Admin, or Super Admin to set one before uploading.");
      return;
    }
    if (new Date(deadline) < new Date()) {
      setError("Time exceeded — the upload deadline has passed. Ask your SPOC, Zone Manager, or Super Admin to extend it.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
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
          deadline_updated_at: existing?.deadline_updated_at ?? null,
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
        // Team Lead acts on any member's NOC; a Member acts on their own — both can
        // view/replace/delete right up until the deadline, not just upload once.
        const canAct = isLead || m.id === profile.id;
        const canUpload = canAct;
        const busy = busyProfileId === m.id;
        const deadline = effectiveDeadlineFor(m.id, m.campus);
        const notConfigured = !deadline;
        const expired = !!deadline && new Date(deadline) < new Date();

        return (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
            <div>
              <p className="font-heading text-sm text-ink">
                {m.name} {m.is_lead && <span className="text-xs text-gold">(Lead)</span>}
              </p>
              <p className={`mt-1 font-heading text-xs ${uploaded ? "text-gitam" : "text-ink-faint"}`}>
                {noc?.status ?? "Not Uploaded"}
              </p>
              <p className={`mt-1 font-heading text-xs ${notConfigured || expired ? "text-danger" : "text-ink-faint"}`}>
                Deadline: {deadline ? new Date(deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not yet set"}
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
              {canUpload && !expired && (
                <>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[m.id] = el;
                    }}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(m.id, m.campus, file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || notConfigured}
                    onClick={() => fileInputRefs.current[m.id]?.click()}
                    title={
                      notConfigured
                        ? "No deadline set yet — ask your SPOC, Zone Manager, Campus Admin, or Super Admin to set one."
                        : undefined
                    }
                    className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-60"
                  >
                    {busy ? "Working…" : notConfigured ? "Deadline Not Set" : uploaded ? "Replace" : "Upload"}
                  </button>
                </>
              )}
              {canAct && uploaded && !expired && (
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
