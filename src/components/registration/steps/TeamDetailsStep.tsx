"use client";

import { useFormContext } from "react-hook-form";
import { FormField, fieldInputClass } from "@/components/registration/FormField";
import { MAX_TEAM_SIZE, MIN_TEAM_SIZE, type RegistrationFormValues } from "@/lib/registration/schema";
import { domains } from "@/data/site-config";
import { cn } from "@/lib/utils";

/**
 * SPEC.md §9 — Step 1: Team Name, Domain, No. of Members. No other
 * information is requested at this stage.
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

      <FormField label="Domain" required error={errors.team?.domainId?.message} htmlFor="team-domain">
        <select
          id="team-domain"
          aria-invalid={!!errors.team?.domainId}
          className={fieldInputClass}
          defaultValue=""
          {...register("team.domainId")}
        >
          <option value="" disabled>
            Select a domain
          </option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
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
