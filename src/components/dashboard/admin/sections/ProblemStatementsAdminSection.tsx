"use client";

import { useState } from "react";
import type { ProblemStatementRow, PsStatus } from "@/types/database";
import { upsertProblemStatement, DashboardActionError } from "@/lib/dashboard/admin-actions";
import { downloadCsv } from "@/lib/csv";

interface FormState {
  id: string | null;
  number: string;
  title: string;
  description: string;
  status: PsStatus;
}

const EMPTY_FORM: FormState = { id: null, number: "", title: "", description: "", status: "Hidden" };

export function ProblemStatementsAdminSection({ problemStatements }: { problemStatements: ProblemStatementRow[] }) {
  const [local, setLocal] = useState(problemStatements);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(ps: ProblemStatementRow) {
    setForm({ id: ps.id, number: ps.number, title: ps.title, description: ps.description ?? "", status: ps.status });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const id = await upsertProblemStatement(form);
      setLocal((prev) => {
        const row: ProblemStatementRow = {
          id,
          number: form.number,
          title: form.title,
          description: form.description || null,
          status: form.status,
          created_at: prev.find((p) => p.id === id)?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const existing = prev.find((p) => p.id === id);
        return existing ? prev.map((p) => (p.id === id ? row : p)) : [...prev, row];
      });
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof DashboardActionError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">
          {form.id ? "Edit Problem Statement" : "New Problem Statement"}
        </span>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <input
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            placeholder="Number, e.g. PS-001"
            required
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            required
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            rows={3}
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold sm:col-span-2"
          />
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PsStatus }))}
            className="rounded-lg border border-border bg-void px-4 py-2.5 font-heading text-sm text-ink outline-none focus:border-gold"
          >
            <option value="Hidden">Hidden</option>
            <option value="Released">Released</option>
          </select>
        </div>
        {error && <p className="mt-3 font-heading text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-gold px-6 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
          >
            {submitting ? "Saving…" : form.id ? "Save Changes" : "Create"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="rounded-full border border-border px-6 py-2.5 font-heading text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {local.length > 0 && (
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "problem-statements",
              local.map((ps) => ({ Number: ps.number, Title: ps.title, Status: ps.status })),
            )
          }
          className="w-fit rounded-full border border-gold/50 px-4 py-2 font-heading text-xs font-medium text-gold transition-colors hover:bg-gold/10"
        >
          Download Problem Statements (CSV)
        </button>
      )}

      <div className="flex flex-col gap-2">
        {local.map((ps) => (
          <button
            key={ps.id}
            type="button"
            onClick={() => startEdit(ps)}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-gold/40"
          >
            <div>
              <p className="font-heading text-sm text-ink">
                #{ps.number} — {ps.title}
              </p>
              <p className={`mt-1 font-heading text-xs ${ps.status === "Released" ? "text-gitam" : "text-ink-muted"}`}>
                {ps.status}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
