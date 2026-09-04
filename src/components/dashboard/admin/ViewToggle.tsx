"use client";

/** Two/N-option view switch, styled after TeamsListSection's "View All (by ID)" toggle. */
export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-3 py-1.5 font-heading text-xs transition-colors ${
              active ? "border-gold bg-gold/10 text-gold" : "border-border text-ink-muted hover:border-gold hover:text-gold"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
