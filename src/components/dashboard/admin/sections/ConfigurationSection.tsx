"use client";

import { useState } from "react";
import { setConfiguration, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { ViewToggle } from "@/components/dashboard/admin/ViewToggle";
import { useTabFade } from "@/hooks/useTabFade";

type View = "all" | "by-category";

/**
 * SPEC §79-88: everything admin-configurable lives in one generic
 * key/value table — new settings don't need new UI or a migration, just a
 * new entry in this list. Datetime fields take a plain ISO 8601 string
 * (e.g. 2026-09-25T16:00:00+05:30) rather than a datetime-local picker,
 * since the stored value is read back as raw text by the RPCs that consume
 * it (select_problem_statement in supabase/migrations/0002/0003).
 */
const KNOWN_KEYS = [
  { key: "problem_statement.spreadsheet_url", label: "Problem Statement Spreadsheet URL", placeholder: "https://docs.google.com/spreadsheets/..." },
  { key: "problem_statement.selection_start", label: "Selection Window Start", placeholder: "2026-09-25T16:00:00+05:30" },
  { key: "problem_statement.selection_end", label: "Selection Window End", placeholder: "2026-09-25T21:30:00+05:30" },
] as const;

// Homepage Journey section (University Level card) shows "to be announced"
// for either of these until set — the Grand Finale's date/venue genuinely
// isn't confirmed pre-launch.
const GRAND_FINALE_KEYS = [
  { key: "grand_finale.date", label: "Grand Finale Date", placeholder: "e.g. December 2026" },
  { key: "grand_finale.venue", label: "Grand Finale Venue", placeholder: "e.g. GITAM Bengaluru" },
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
// datetime config value — see KNOWN_KEYS' comment above.
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
    for (const { key } of [...KNOWN_KEYS, ...GRAND_FINALE_KEYS]) {
      const raw = config[key];
      initial[key] = typeof raw === "string" ? raw : "";
    }
    const rawPrivacy = config[PRIVACY_POLICY_KEY];
    initial[PRIVACY_POLICY_KEY] = typeof rawPrivacy === "string" ? rawPrivacy : "";
    const rawTnc = config[TNC_URL_KEY];
    initial[TNC_URL_KEY] = typeof rawTnc === "string" ? rawTnc : "";
    for (const { key } of DEADLINE_KEYS) {
      const raw = config[key];
      initial[key] = toDatetimeLocal(typeof raw === "string" ? raw : null);
    }
    return initial;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [view, setView] = useState<View>("all");
  const fadeRef = useTabFade(view);

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

  function simpleFields(keys: readonly { key: string; label: string; placeholder: string }[]) {
    return keys.map(({ key, label, placeholder }) => (
      <div key={key} className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{label}</span>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            value={values[key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <button
            type="button"
            disabled={savingKey === key}
            onClick={() => handleSave(key)}
            className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {savingKey === key ? "Saving…" : "Save"}
          </button>
        </div>
        {message[key] && <p className="mt-2 font-heading text-xs text-ink-muted">{message[key]}</p>}
      </div>
    ));
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

  function deadlineField({ key, label, hint, description }: (typeof DEADLINE_KEYS)[number]) {
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

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle
        value={view}
        onChange={setView}
        options={[
          { value: "all", label: "All Settings" },
          { value: "by-category", label: "By Category" },
        ]}
      />

      <div ref={fadeRef} className="flex flex-col gap-6">
        {view === "all" ? (
          <div className="flex flex-col gap-4">
            {simpleFields(KNOWN_KEYS)}
            {DEADLINE_KEYS.map((d) => deadlineField(d))}
            {simpleFields(GRAND_FINALE_KEYS)}
            {tncField()}
            {privacyField()}
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 font-heading text-xs tracking-[0.2em] text-gold uppercase">
                Problem Statement Settings
              </p>
              <div className="flex flex-col gap-4">{simpleFields(KNOWN_KEYS)}</div>
            </div>
            <div>
              <p className="mb-2 font-heading text-xs tracking-[0.2em] text-gold uppercase">PPT &amp; NOC Deadlines</p>
              <div className="flex flex-col gap-4">{DEADLINE_KEYS.map((d) => deadlineField(d))}</div>
            </div>
            <div>
              <p className="mb-2 font-heading text-xs tracking-[0.2em] text-gold uppercase">Grand Finale (University Level)</p>
              <div className="flex flex-col gap-4">{simpleFields(GRAND_FINALE_KEYS)}</div>
            </div>
            <div>
              <p className="mb-2 font-heading text-xs tracking-[0.2em] text-gold uppercase">Site Content</p>
              <div className="flex flex-col gap-4">
                {tncField()}
                {privacyField()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
