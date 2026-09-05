"use client";

import { useRef, useState } from "react";
import type { NocRow } from "@/types/database";
import {
  deleteNoc,
  deleteNocFile,
  getSignedUrl,
  recordNocMetadata,
  uploadNocFile,
  DashboardActionError,
} from "@/lib/dashboard/team-actions";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * NOC status + View/Delete actions for one member — shared by
 * TeamsByMembersView and TeamDetailModal. `canUpload` additionally lets
 * Super Admin upload/replace on the member's behalf (record_noc_metadata
 * and the noc-uploads storage policy already allow this — see 0015).
 */
export function NocStatus({
  profileId,
  noc,
  canUpload = false,
  onDeleted,
  onUploaded,
}: {
  profileId: string;
  noc: NocRow | undefined;
  canUpload?: boolean;
  onDeleted: () => void;
  onUploaded?: (filePath: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds the 2MB limit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = await uploadNocFile(profileId, file);
      await recordNocMetadata(profileId, path);
      onUploaded?.(path);
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
        <button type="button" onClick={handleView} className="text-gold underline">
          View
        </button>
      )}
      {canUpload && (
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
            className="text-gold underline disabled:opacity-60"
          >
            {busy ? "Working…" : uploaded ? "Replace" : "Upload"}
          </button>
        </>
      )}
      {uploaded && (
        <button type="button" disabled={busy} onClick={handleDelete} className="text-danger underline disabled:opacity-60">
          Delete
        </button>
      )}
      {error && <span className="font-heading text-xs text-danger">{error}</span>}
    </div>
  );
}
