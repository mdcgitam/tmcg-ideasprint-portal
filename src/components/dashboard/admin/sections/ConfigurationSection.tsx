"use client";

import { useState } from "react";
import type { ProfileRow } from "@/types/database";
import { setConfiguration, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { effectiveConfigValue, campusConfigKey } from "@/lib/dashboard/campus-config";
import { parseDocumentLinks, type DocumentLink } from "@/components/dashboard/DocumentsSection";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

const DOCUMENTS_KEY = "documents.list";

/**
 * SPEC §79-88: everything admin-configurable lives in one generic
 * key/value table — new settings don't need new UI or a migration, just a
 * new entry in one of these lists. Datetime settings use a calendar
 * date + time picker and are stored as a timestamptz-parseable ISO 8601
 * string (e.g. 2026-09-25T16:00:00.000Z), the form the consuming RPCs read
 * back as raw text (select_problem_statement / record_presentation /
 * record_noc_metadata, see 0002/0003/0027/0028/0048).
 *
 * The Problem Statement spreadsheet URL and the "Go Live" release control
 * live on the Problem Statements page instead — see
 * ProblemStatementsAdminSection.tsx.
 *
 * Campus scoping (0048): the four fields below are campus-overridable — a
 * Campus Admin's save writes a campus-suffixed key (e.g.
 * "noc.general_deadline.VSP") instead of the global one, and their form
 * displays the value in effect for their campus (their override if set,
 * else the Super Admin's global default). Privacy Policy and Terms &
 * Conditions stay Super-Admin-only, not shown to a Campus Admin at all.
 */

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

// Super-Admin-only — Item 23: edits the /privacy page content directly from here.
const PRIVACY_POLICY_KEY = "privacy_policy.content";

// Super-Admin-only — homepage Instructions section shows the T&C box only once this is set.
const TNC_URL_KEY = "terms_and_conditions.url";

const DEADLINE_KEYS = [
  {
    key: "noc.general_deadline",
    label: "General NOC Deadline",
    hint: "Default NOC submission deadline for every member. Members with an individually extended deadline (set from the NOC page) keep their own instead.",
    description: "Default NOC submission deadline for members without an individually extended deadline.",
  },
  {
    key: "ppt.general_deadline",
    label: "General PPT Deadline",
    hint: "Default presentation submission deadline for every team. Teams with an individually extended deadline (set from the PPT page) keep their own instead.",
    description: "Default PPT submission deadline for teams without an individually extended deadline.",
  },
] as const;

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type View = "settings" | "documents";

export function ConfigurationSection({ config, profile }: { config: Record<string, unknown>; profile: ProfileRow }) {
  const isSuperAdmin = profile.role === "Super Admin";
  const campus = profile.campus;

  // Campus Admin writes/reads a campus-suffixed key for these four; Super Admin always uses the global key.
  function writeKeyFor(baseKey: string): string {
    return !isSuperAdmin && campus ? campusConfigKey(baseKey, campus) : baseKey;
  }

  const [view, setView] = useState<View>("settings");
  const fadeRef = useTabFade(view);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (isSuperAdmin) {
      const rawPrivacy = config[PRIVACY_POLICY_KEY];
      initial[PRIVACY_POLICY_KEY] = typeof rawPrivacy === "string" ? rawPrivacy : "";
      const rawTnc = config[TNC_URL_KEY];
      initial[TNC_URL_KEY] = typeof rawTnc === "string" ? rawTnc : "";
    }
    for (const { key } of [...SELECTION_WINDOW_KEYS, ...DEADLINE_KEYS]) {
      initial[key] = toDatetimeLocal(effectiveConfigValue(config, key, isSuperAdmin ? null : campus));
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
    saveDocuments([...documents, { name, url, campus: isSuperAdmin ? null : campus }]);
    setNewDocName("");
    setNewDocUrl("");
  }

  function handleRemoveDocument(doc: DocumentLink) {
    saveDocuments(documents.filter((d) => d !== doc));
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

  async function handleSaveDeadline(baseKey: string, description: string) {
    setSavingKey(baseKey);
    setMessage((m) => ({ ...m, [baseKey]: "" }));
    try {
      const iso = values[baseKey] ? new Date(values[baseKey]).toISOString() : null;
      await setConfiguration(writeKeyFor(baseKey), iso, description);
      setMessage((m) => ({ ...m, [baseKey]: isSuperAdmin ? "Saved." : `Saved — applies to ${campus} only.` }));
    } catch (err) {
      setMessage((m) => ({ ...m, [baseKey]: err instanceof DashboardActionError ? err.message : "Something went wrong." }));
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
        {!isSuperAdmin && (
          <p className="mt-1 font-heading text-xs text-gold">
            Showing the value in effect for {campus} — your own override if set, otherwise the Super Admin&rsquo;s default. Saving only changes it for {campus}.
          </p>
        )}
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
    const visibleDocuments = isSuperAdmin ? documents : documents.filter((d) => !d.campus || d.campus === campus);
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Documents</span>
        <p className="mt-1 font-heading text-xs text-ink-muted">
          {isSuperAdmin
            ? "Shown as cards in every role's Documents module. Add as many links as you need."
            : `Global links plus your own additions, shown to ${campus}. Yours are removable; the Super Admin's aren't.`}
        </p>

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

        {visibleDocuments.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {visibleDocuments.map((doc, i) => {
              const canRemove = isSuperAdmin || doc.campus === campus;
              return (
                <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-void px-4 py-2.5">
                  <span className="font-heading text-sm text-ink">{doc.name}</span>
                  {!doc.campus && !isSuperAdmin && (
                    <span className="rounded-full bg-gold/10 px-2 py-0.5 font-heading text-[10px] text-gold uppercase">Global</span>
                  )}
                  <span className="flex-1 truncate font-heading text-xs text-ink-muted">{doc.url}</span>
                  {canRemove && (
                    <button
                      type="button"
                      disabled={savingDocs}
                      onClick={() => handleRemoveDocument(doc)}
                      className="text-danger underline disabled:opacity-60"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "settings", label: "Settings" },
          { value: "documents", label: "Documents" },
        ]}
      />

      <div ref={fadeRef} className="flex flex-col gap-4">
        {view === "settings" ? (
          <>
            {SELECTION_WINDOW_KEYS.map((d) => deadlineField(d))}
            {DEADLINE_KEYS.map((d) => deadlineField(d))}
            {isSuperAdmin && tncField()}
            {isSuperAdmin && privacyField()}
          </>
        ) : (
          documentsField()
        )}
      </div>
    </div>
  );
}
