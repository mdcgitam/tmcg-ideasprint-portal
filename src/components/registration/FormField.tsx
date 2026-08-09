"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

export const fieldInputClass = cn(
  "w-full rounded-lg border border-border bg-surface px-4 py-3 font-heading text-sm text-ink placeholder:text-ink-faint",
  "transition-colors duration-200 outline-none focus:border-gold focus:ring-1 focus:ring-gold",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger",
);

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode | ((id: string) => ReactNode);
}

/**
 * Label + input slot + animated error state, shared across every
 * registration step so validation feels consistent (prompt.md §19).
 */
export function FormField({ label, htmlFor, error, hint, required, children }: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-heading text-xs tracking-wide text-ink-muted uppercase">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </label>
      {typeof children === "function" ? children(id) : children}
      <div className="grid transition-all duration-200" style={{ gridTemplateRows: error ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <p className="pt-1 font-mono text-xs text-danger">{error}</p>
        </div>
      </div>
      {!error && hint && <p className="font-mono text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
