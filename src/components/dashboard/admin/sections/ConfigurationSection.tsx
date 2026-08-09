"use client";

import { useState } from "react";
import { setConfiguration, DashboardActionError } from "@/lib/dashboard/admin-actions";

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

export function ConfigurationSection({ config }: { config: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const { key } of KNOWN_KEYS) {
      const raw = config[key];
      initial[key] = typeof raw === "string" ? raw : "";
    }
    return initial;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});

  async function handleSave(key: string) {
    setSavingKey(key);
    setMessage((m) => ({ ...m, [key]: "" }));
    try {
      await setConfiguration(key, values[key], "");
      setMessage((m) => ({ ...m, [key]: "Saved." }));
    } catch (err) {
      setMessage((m) => ({ ...m, [key]: err instanceof DashboardActionError ? err.message : "Something went wrong." }));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {KNOWN_KEYS.map(({ key, label, placeholder }) => (
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
      ))}
    </div>
  );
}
