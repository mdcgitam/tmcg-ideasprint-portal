"use client";

import { useFormContext } from "react-hook-form";
import { FormField, fieldInputClass } from "@/components/registration/FormField";
import { MAX_TEAM_SIZE, MIN_TEAM_SIZE, type RegistrationFormValues } from "@/lib/registration/schema";
import { cn } from "@/lib/utils";

/**
 * Step 1: Team Name, No. of Members. Domain has been dropped as a concept
 * (ideasprint_changes.pdf item 1) — no other information is requested here.
 */
export function TeamDetailsStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>();

  const memberCount = watch("team.memberCount");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Step 1</span>
        <h1 className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">Basic Team Details</h1>
      </div>

      <FormField label="Team Name" required error={errors.team?.teamName?.message} htmlFor="team-name">
        <input
          id="team-name"
          type="text"
          placeholder="e.g. Nightshift Coders"
          aria-invalid={!!errors.team?.teamName}
          className={fieldInputClass}
          {...register("team.teamName")}
        />
      </FormField>

      <FormField label="Number of Members" required error={errors.team?.memberCount?.message}>
        <div className="flex gap-3">
          {([MIN_TEAM_SIZE, MAX_TEAM_SIZE] as const).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setValue("team.memberCount", count, { shouldValidate: true })}
              className={cn(
                "flex-1 rounded-lg border px-4 py-3 font-heading text-sm transition-colors",
                memberCount === count
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border bg-surface text-ink-muted hover:border-border-strong",
              )}
            >
              {count} Members
            </button>
          ))}
        </div>
      </FormField>
      <p className="-mt-4 font-mono text-xs text-ink-faint">The Team Lead (you) counts as one of the members.</p>
    </div>
  );
}
