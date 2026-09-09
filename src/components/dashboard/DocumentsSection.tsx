import { FileText } from "lucide-react";

export interface DocumentLink {
  name: string;
  url: string;
}

export function parseDocumentLinks(config: Record<string, unknown>): DocumentLink[] {
  const raw = config["documents.list"];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is DocumentLink =>
      typeof d === "object" && d !== null && typeof (d as DocumentLink).name === "string" && typeof (d as DocumentLink).url === "string",
  );
}

/** Shared by every dashboard (admin/spoc/zone launcher pages and the Team dashboard) — a read-only grid of admin-configured document links. */
export function DocumentsSection({ config }: { config: Record<string, unknown> }) {
  const documents = parseDocumentLinks(config);

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-heading text-sm text-ink-muted">No documents have been shared yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-gold/10 text-gold">
            <FileText className="size-5" strokeWidth={1.5} />
          </span>
          <div className="flex-1">
            <h3 className="font-heading text-sm font-medium text-ink">{doc.name}</h3>
            <p className="mt-1 font-heading text-xs text-ink-muted">Opens in a new tab.</p>
          </div>
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit rounded-full bg-gold px-4 py-2 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light"
          >
            Open ↗
          </a>
        </div>
      ))}
    </div>
  );
}
