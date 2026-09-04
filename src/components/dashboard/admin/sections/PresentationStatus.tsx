"use client";

import { useState } from "react";
import type { PresentationRow } from "@/types/database";
import { deletePresentation, deletePresentationFile, getSignedUrl, DashboardActionError } from "@/lib/dashboard/team-actions";

/** Presentation (PPT) status + View/Delete for one team — the PPT half of the admin "NOC & PPT" box. */
export function PresentationStatus({
  teamId,
  presentation,
  onDeleted,
}: {
  teamId: string;
  presentation: PresentationRow | undefined;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploaded = presentation?.status === "Uploaded" && presentation.file_path;

  async function handleView() {
    if (!presentation?.file_path) return;
    const url = await getSignedUrl("ppt-uploads", presentation.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    if (!presentation?.file_path) return;
    setBusy(true);
    setError(null);
    try {
      await deletePresentationFile(presentation.file_path);
      await deletePresentation(teamId);
      onDeleted();
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{presentation?.status ?? "Not Uploaded"}</span>
      {uploaded && (
        <>
          <button type="button" onClick={handleView} className="text-gold underline">
            View
          </button>
          <button type="button" disabled={busy} onClick={handleDelete} className="text-danger underline disabled:opacity-60">
            Delete
          </button>
        </>
      )}
      {error && <span className="font-heading text-xs text-danger">{error}</span>}
    </div>
  );
}
