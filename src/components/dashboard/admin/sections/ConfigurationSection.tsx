"use client";

import { useState } from "react";
import { setConfiguration, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { parseDocumentLinks, type DocumentLink } from "@/components/dashboard/DocumentsSection";

const DOCUMENTS_KEY = "documents.list";

/**
 * SPEC §79-88: everything admin-configurable lives in one generic
 * key/value table — new settings don't need new UI or a migration, just a
 * new entry in one of these lists. Datetime settings use a calendar
 * date + time picker and are stored as a timestamptz-parseable ISO 8601
 * string (e.g. 2026-09-25T16:00:00.000Z), the form the consuming RPCs read
 * back as raw text (select_problem_statement in supabase/migrations/
 * 0002/0003; record_presentation / record_noc_metadata in 0027/0028).
 *
 * The Problem Statement spreadsheet URL and the "Go Live" release control
 * live on the Problem Statements page instead — see
 * ProblemStatementsAdminSection.tsx.
 */

// Selection window — calendar date + time pickers. Stored as a
// timestamptz-parseable ISO string (same convention as the deadline keys
// below), read back by select_problem_statement (supabase/migrations/
// 0002/0003) to gate the Team Lead selection flow. The window End also acts
// as the default per-team deadline shown in the Problem Statements module.
const SELECTION_WINDOW_KEYS = [
  {
    key: "problem_statement.selection_start",
    label: "Problem Statement Selection Start",
    hint: "When Team Leads can begin selecting a problem statement.",
    description: "Problem statement selection window open time.",
  },
  {
    key: "problem_statement.selection_end",
    label: "Problem Statement Selection End",
    hint: "When problem statement selection closes. Also the default deadline shown per team in the Problem Statements module.",
    description: "Problem statement selection window close time.",
  },
] as const;

// Item 23: Super Admin edits the /privacy page content directly from here —
// plain paragraphs, a blank line starts a new one. Empty = built-in default copy.
const PRIVACY_POLICY_KEY = "privacy_policy.content";

// Homepage Instructions section shows the Terms & Conditions box only once
// this is set — empty means no dead link ships on the live site.
const TNC_URL_KEY = "terms_and_conditions.url";

// General deadline fields — each read by its own page (PptSection.tsx /
// NocTeamsView.tsx / NocIndividualsView.tsx) and enforced server-side
// (record_presentation 0027 / record_noc_metadata 0028) as the default
// deadline for teams/members without an individually extended one. Stored
// as a timestamptz-parseable ISO string, same convention as every other
// datetime config value.
const DEADLINE_KEYS = [
  {
    key: "ppt.general_deadline",
    label: "General PPT Deadline",
    hint: "Default presentation submission deadline for every team. Teams with an individually extended deadline (set from the PPT page) keep their own instead.",
    description: "Default PPT submission deadline for teams without an individually extended deadline.",
  },
  {
    key: "noc.general_deadline",
    label: "General NOC Deadline",
    hint: "Default NOC submission deadline for every member. Members with an individually extended deadline (set from the NOC page) keep their own instead.",
    description: "Default NOC submission deadline for members without an individually extended deadline.",
  },
] as const;

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ConfigurationSection({ config }: { config: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const rawPrivacy = config[PRIVACY_POLICY_KEY];
    initial[PRIVACY_POLICY_KEY] = typeof rawPrivacy === "string" ? rawPrivacy : "";
    const rawTnc = config[TNC_URL_KEY];
    initial[TNC_URL_KEY] = typeof rawTnc === "string" ? rawTnc : "";
    for (const { key } of [...SELECTION_WINDOW_KEYS, ...DEADLINE_KEYS]) {
      const raw = config[key];
      initial[key] = toDatetimeLocal(typeof raw === "string" ? raw : null);
    }
    return initial;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});

  const [documents, setDocuments] = useState<DocumentLink[]>(() => parseDocumentLinks(config));
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [savingDocs, setSavingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  async function saveDocuments(next: DocumentLink[]) {
    setSavingDocs(true);
    setDocsError(null);
    try {
      await setConfiguration(DOCUMENTS_KEY, next, "Document links shown in the Documents module.");
      setDocuments(next);
    } catch (err) {
      setDocsError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSavingDocs(false);
    }
  }

  function handleAddDocument() {
    const name = newDocName.trim();
    const url = newDocUrl.trim();
    if (!name || !url) {
      setDocsError("Enter both a name and a link.");
      return;
    }
    saveDocuments([...documents, { name, url }]);
    setNewDocName("");
    setNewDocUrl("");
  }

  function handleRemoveDocument(index: number) {
    saveDocuments(documents.filter((_, i) => i !== index));
  }

  async function handleSave(key: string) {
    setSavingKey(key);
    setMessage((m) => ({ ...m, [key]: "" }));
    try {
      await setConfiguration(key, values[key] || null, "");
      setMessage((m) => ({ ...m, [key]: "Saved." }));
    } catch (err) {
      setMessage((m) => ({ ...m, [key]: err instanceof DashboardActionError ? err.message : "Something went wrong." }));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveDeadline(key: string, description: string) {
    setSavingKey(key);
    setMessage((m) => ({ ...m, [key]: "" }));
    try {
      const iso = values[key] ? new Date(values[key]).toISOString() : null;
      await setConfiguration(key, iso, description);
      setMessage((m) => ({ ...m, [key]: "Saved." }));
    } catch (err) {
      setMessage((m) => ({ ...m, [key]: err instanceof DashboardActionError ? err.message : "Something went wrong." }));
    } finally {
      setSavingKey(null);
    }
  }

  function deadlineField({
    key,
    label,
    hint,
    description,
  }: {
    key: string;
    label: string;
    hint: string;
    description: string;
  }) {
    return (
      <div key={key} className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{label}</span>
        <p className="mt-1 font-heading text-xs text-ink-muted">{hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="datetime-local"
            value={values[key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingKey === key}
            onClick={() => handleSaveDeadline(key, description)}
            className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {savingKey === key ? "Saving…" : "Save"}
          </button>
        </div>
        {message[key] && <p className="mt-2 font-heading text-xs text-ink-muted">{message[key]}</p>}
      </div>
    );
  }

  function tncField() {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Terms &amp; Conditions URL</span>
        <p className="mt-1 font-heading text-xs text-ink-muted">
          Shown as a box in the homepage Instructions section only once this is set.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            value={values[TNC_URL_KEY] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [TNC_URL_KEY]: e.target.value }))}
            placeholder="https://docs.google.com/document/..."
            className="flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingKey === TNC_URL_KEY}
            onClick={() => handleSave(TNC_URL_KEY)}
            className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {savingKey === TNC_URL_KEY ? "Saving…" : "Save"}
          </button>
        </div>
        {message[TNC_URL_KEY] && <p className="mt-2 font-heading text-xs text-ink-muted">{message[TNC_URL_KEY]}</p>}
      </div>
    );
  }

  function privacyField() {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Privacy Policy Content</span>
        <p className="mt-1 font-heading text-xs text-ink-muted">
          Plain paragraphs — a blank line starts a new one. Leave empty to use the built-in default copy.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <textarea
            rows={10}
            value={values[PRIVACY_POLICY_KEY] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [PRIVACY_POLICY_KEY]: e.target.value }))}
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingKey === PRIVACY_POLICY_KEY}
            onClick={() => handleSave(PRIVACY_POLICY_KEY)}
            className="w-fit rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {savingKey === PRIVACY_POLICY_KEY ? "Saving…" : "Save"}
          </button>
        </div>
        {message[PRIVACY_POLICY_KEY] && (
          <p className="mt-2 font-heading text-xs text-ink-muted">{message[PRIVACY_POLICY_KEY]}</p>
        )}
      </div>
    );
  }

  function documentsField() {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Documents</span>
        <p className="mt-1 font-heading text-xs text-ink-muted">
          Shown as cards in every role&rsquo;s Documents module. Add as many links as you need.
        </p>

        {documents.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {documents.map((doc, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-void px-4 py-2.5">
                <span className="font-heading text-sm text-ink">{doc.name}</span>
                <span className="flex-1 truncate font-heading text-xs text-ink-muted">{doc.url}</span>
                <button
                  type="button"
                  disabled={savingDocs}
                  onClick={() => handleRemoveDocument(i)}
                  className="text-danger underline disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
            placeholder="Name (e.g. Guidelines & Rule Book)"
            className="min-w-[180px] flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <input
            value={newDocUrl}
            onChange={(e) => setNewDocUrl(e.target.value)}
            placeholder="https://..."
            className="min-w-[220px] flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingDocs}
            onClick={handleAddDocument}
            className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {savingDocs ? "Saving…" : "Add"}
          </button>
        </div>
        {docsError && <p className="mt-2 font-heading text-xs text-danger">{docsError}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {SELECTION_WINDOW_KEYS.map((d) => deadlineField(d))}
      {DEADLINE_KEYS.map((d) => deadlineField(d))}
      {tncField()}
      {privacyField()}
      {documentsField()}
    </div>
  );
}
