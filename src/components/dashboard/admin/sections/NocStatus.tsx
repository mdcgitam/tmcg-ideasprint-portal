"use client";

import { useState } from "react";
import type { NocRow } from "@/types/database";
import { deleteNoc, deleteNocFile, getSignedUrl, DashboardActionError } from "@/lib/dashboard/team-actions";

/** NOC status + View/Delete actions for one member — shared by TeamsByMembersView and TeamDetailModal. */
export function NocStatus({
  profileId,
  noc,
  onDeleted,
}: {
  profileId: string;
  noc: NocRow | undefined;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploaded = noc?.status === "Uploaded" && noc.file_path;

  async function handleView() {
    if (!noc?.file_path) return;
    const url = await getSignedUrl("noc-uploads", noc.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    if (!noc?.file_path) return;
    setBusy(true);
    setError(null);
    try {
      await deleteNocFile(noc.file_path);
      await deleteNoc(profileId);
      onDeleted();
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>{noc?.status ?? "Not Uploaded"}</span>
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
