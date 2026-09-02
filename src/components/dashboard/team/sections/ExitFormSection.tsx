"use client";

import { useRef, useState } from "react";
import type { TeamRow, ExitStatus, ExitFormRow } from "@/types/database";
import { uploadExitFormFile, recordExitForm, getSignedUrl, DashboardActionError } from "@/lib/dashboard/team-actions";

/**
 * Only the Team Lead may upload the (already-signed, physical) Exit Form;
 * Members see status only. Not a mandatory submission for every team — it's
 * only for teams that want to exit the event partway through
 * (ideasprint_changes.pdf item 16).
 */
export function ExitFormSection({
  team,
  exitForm,
  isLead,
}: {
  team: TeamRow;
  exitForm: ExitFormRow | null;
  isLead: boolean;
}) {
  const [local, setLocal] = useState(exitForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const status: ExitStatus = local?.status ?? "Not Submitted";

  async function handleUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadExitFormFile(team.id, file);
      await recordExitForm(team.id, path);
      setLocal({
        id: local?.id ?? crypto.randomUUID(),
        team_id: team.id,
        file_path: path,
        status: "Submitted",
        uploaded_by: null,
        uploaded_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleView() {
    if (!local?.file_path) return;
    const url = await getSignedUrl("exit-forms", local.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Exit Form</span>
      <p className={`mt-3 font-heading text-lg ${status === "Submitted" ? "text-gitam" : "text-ink-muted"}`}>{status}</p>
      <p className="mt-2 max-w-lg font-heading text-xs text-ink-muted">
        This is <span className="text-ink">not a mandatory submission</span> — it&rsquo;s only for teams that want
        to exit the event partway through. Only the already-signed, physical exit form needs to be uploaded here.
      </p>

      <div className="mt-4 flex items-center gap-3">
        {local?.file_path && (
          <button type="button" onClick={handleView} className="font-heading text-sm text-gold underline">
            View
          </button>
        )}
        {isLead && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-60"
            >
              {busy ? "Working…" : local?.file_path ? "Replace" : "Upload"}
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-3 font-heading text-sm text-danger">{error}</p>}
    </div>
  );
}
