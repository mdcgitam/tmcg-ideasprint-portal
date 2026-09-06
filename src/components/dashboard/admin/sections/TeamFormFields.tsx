import type { UpdateMemberInput } from "@/lib/dashboard/admin-actions";
import {
  ALL_YEARS,
  GENDER_OPTIONS,
  GRADUATION_OPTIONS,
  SCHOOL_OPTIONS,
  STAY_OPTIONS,
  branchesFor,
  departmentsFor,
  programsFor,
  yearsFor,
} from "@/lib/registration/academic";

// Kept for the Members filter bar's Year dropdown.
export const YEAR_OPTIONS = [...ALL_YEARS];

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
  const patch = (p: Partial<UpdateMemberInput>) => onChange({ ...form, ...p });

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-gold/30 bg-void p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <EditField label="Name" value={form.name} onChange={(v) => patch({ name: v })} />
        <EditField label="Email" value={form.gitam_email} onChange={(v) => patch({ gitam_email: v })} />
        <EditField label="Phone" value={form.phone} onChange={(v) => patch({ phone: v })} />
        <EditField label="Reg No" value={form.reg_no} onChange={(v) => patch({ reg_no: v })} />

        <EditSelect
          label="Graduation"
          value={form.graduation}
          placeholder="Select Graduation"
          options={[...GRADUATION_OPTIONS]}
          onChange={(v) => patch({ graduation: v, program: "", year_of_study: "" })}
        />
        <EditSelect
          label="Program"
          value={form.program}
          placeholder="Select Program"
          options={programsFor(form.graduation)}
          disabled={!form.graduation}
          onChange={(v) => patch({ program: v, year_of_study: "" })}
        />
        <EditSelect
          label="Year of Study"
          value={form.year_of_study}
          placeholder="Select Year of Study"
          options={yearsFor(form.program)}
          disabled={!form.program}
          onChange={(v) => patch({ year_of_study: v })}
        />
        <EditSelect
          label="Gender"
          value={form.gender}
          placeholder="Select Gender"
          options={[...GENDER_OPTIONS]}
          onChange={(v) => patch({ gender: v })}
        />
        <EditSelect
          label="School"
          value={form.school}
          placeholder="Select School"
          options={[...SCHOOL_OPTIONS]}
          onChange={(v) => patch({ school: v, department: "", branch: "" })}
        />
        <EditSelect
          label="Department"
          value={form.department}
          placeholder="Select Department"
          options={departmentsFor(form.school)}
          disabled={!form.school}
          onChange={(v) => patch({ department: v, branch: "" })}
        />
        <EditSelect
          label="Branch"
          value={form.branch}
          placeholder="Select Branch"
          options={branchesFor(form.department)}
          disabled={!form.department}
          onChange={(v) => patch({ branch: v })}
        />
        <EditSelect
          label="Stay"
          value={form.stay}
          placeholder="Select Stay"
          options={[...STAY_OPTIONS]}
          onChange={(v) => patch({ stay: v })}
        />
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
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder: string;
  disabled?: boolean;
}) {
  // Surface a legacy/out-of-list value so the admin can see and change it.
  const isLegacy = value !== "" && !options.includes(value);
  return (
    <label className="flex flex-col gap-1 font-heading text-xs text-ink-muted">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 font-heading text-sm text-ink outline-none focus:border-gold disabled:opacity-50"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {isLegacy && <option value={value}>{value} (current — not in list)</option>}
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
