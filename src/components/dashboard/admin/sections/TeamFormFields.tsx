import type { UpdateMemberInput } from "@/lib/dashboard/admin-actions";

export const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
export const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

export function MemberEditForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  form: UpdateMemberInput;
  onChange: (form: UpdateMemberInput) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-gold/30 bg-void p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <EditField label="Name" value={form.name} onChange={(v) => onChange({ ...form, name: v })} />
        <EditField label="Email" value={form.gitam_email} onChange={(v) => onChange({ ...form, gitam_email: v })} />
        <EditField label="Phone" value={form.phone} onChange={(v) => onChange({ ...form, phone: v })} />
        <EditField label="Reg./Roll No." value={form.reg_no} onChange={(v) => onChange({ ...form, reg_no: v })} />
        <EditSelect
          label="Year of Study"
          value={form.year_of_study}
          onChange={(v) => onChange({ ...form, year_of_study: v })}
          options={YEAR_OPTIONS}
        />
        <EditSelect
          label="Gender"
          value={form.gender}
          onChange={(v) => onChange({ ...form, gender: v })}
          options={GENDER_OPTIONS}
        />
        <EditField label="School" value={form.school} onChange={(v) => onChange({ ...form, school: v })} />
        <EditField label="Department" value={form.department} onChange={(v) => onChange({ ...form, department: v })} />
        <EditField label="Branch" value={form.branch} onChange={(v) => onChange({ ...form, branch: v })} />
        <EditField label="Stay" value={form.stay} onChange={(v) => onChange({ ...form, stay: v })} />
      </div>
      {error && <p className="font-heading text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-full bg-gold px-4 py-1.5 font-heading text-xs font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-full border border-border px-4 py-1.5 font-heading text-xs text-ink-muted transition-colors hover:bg-surface disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
      />
    </label>
  );
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  valueOptions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  valueOptions?: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-void px-3 py-1.5 font-heading text-xs text-ink outline-none focus:border-gold"
    >
      <option value="">{label}: All</option>
      {options.map((opt, i) => (
        <option key={opt} value={valueOptions ? valueOptions[i] : opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
