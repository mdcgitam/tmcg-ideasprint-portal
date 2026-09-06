"use client";

import { useRef, useState } from "react";
import type { PresentationRow, PresentationStatus, TeamRow } from "@/types/database";
import {
  uploadPresentationFile,
  deletePresentationFile,
  recordPresentation,
  deletePresentation,
  getSignedUrl,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";

const ACCEPT = ".pdf,application/pdf";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const GENERAL_DEADLINE_KEY = "ppt.general_deadline";

/**
 * Team Lead uploads the team's pitch deck; Members see status only — same
 * shape as ExitFormSection. Files must be a PDF, 2MB or less (matches the
 * ppt-uploads storage bucket's file_size_limit/allowed_mime_types).
 */
export function PresentationSection({
  team,
  presentation,
  isLead,
  config,
}: {
  team: TeamRow;
  presentation: PresentationRow | null;
  isLead: boolean;
  config: Record<string, unknown>;
}) {
  const [local, setLocal] = useState(presentation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const status: PresentationStatus = local?.status ?? "Not Uploaded";
  const uploaded = status === "Uploaded" && local?.file_path;

  // Team-specific deadline (record_presentation/0027) wins over the
  // Configuration-wide General PPT Deadline set by Super Admin.
  const rawGeneralDeadline = config[GENERAL_DEADLINE_KEY];
  const generalDeadline = typeof rawGeneralDeadline === "string" && rawGeneralDeadline ? rawGeneralDeadline : null;
  const effectiveDeadline = local?.deadline ?? generalDeadline;
  const expired = !!effectiveDeadline && new Date(effectiveDeadline) < new Date();

  async function handleUpload(file: File) {
    if (expired) {
      setError("Time exceeded — the upload deadline has passed. Ask your SPOC or Super Admin to extend it.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("PDF file size must be 2 MB or less.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await uploadPresentationFile(team.id, file);
      await recordPresentation(team.id, path);
      setLocal({
        id: local?.id ?? crypto.randomUUID(),
        team_id: team.id,
        file_path: path,
        status: "Uploaded",
        uploaded_by: null,
        uploaded_at: new Date().toISOString(),
        deadline: local?.deadline ?? null,
      });
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleView() {
    if (!local?.file_path) return;
    const url = await getSignedUrl("ppt-uploads", local.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    if (!local?.file_path) return;
    setBusy(true);
    setError(null);
    try {
      await deletePresentationFile(local.file_path);
      await deletePresentation(team.id);
      setLocal((prev) => (prev ? { ...prev, status: "Not Uploaded", file_path: null } : prev));
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Presentation (PPT)</span>
      <p className={`mt-3 font-heading text-lg ${uploaded ? "text-gitam" : "text-ink-muted"}`}>{status}</p>
      <p className="mt-2 max-w-lg font-heading text-xs text-ink-muted">
        Upload your team&rsquo;s pitch deck. Only the Team Lead can upload — PDF only, max 2MB.
      </p>
      <p className={`mt-2 font-heading text-xs ${expired ? "text-danger" : "text-ink-faint"}`}>
        Deadline:{" "}
        {effectiveDeadline
          ? new Date(effectiveDeadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
          : "Not set"}
        {expired && " — Time exceeded"}
      </p>

      <div className="mt-4 flex items-center gap-3">
        {uploaded && (
          <button type="button" onClick={handleView} className="font-heading text-sm text-gold underline">
            View
          </button>
        )}
        {isLead && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy || expired}
              onClick={() => fileInputRef.current?.click()}
              title={expired ? "Deadline passed — ask your SPOC or Super Admin to extend it." : undefined}
              className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-60"
            >
              {busy ? "Working…" : expired ? "Time Exceeded" : uploaded ? "Replace" : "Upload"}
            </button>
            {uploaded && (
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="rounded-full border border-danger/40 px-4 py-1.5 font-heading text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className="mt-3 font-heading text-sm text-danger">{error}</p>}
    </div>
  );
}
