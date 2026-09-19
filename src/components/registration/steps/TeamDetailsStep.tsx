"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { FormField, fieldInputClass } from "@/components/registration/FormField";
import { CAMPUS_OPTIONS, MAX_TEAM_SIZE, MIN_TEAM_SIZE, type CampusCode, type RegistrationFormValues } from "@/lib/registration/schema";
import { getCampusSlotCounts, type CampusSlots } from "@/lib/registration/availability";
import { cn } from "@/lib/utils";

function remainingSlots(slots: CampusSlots | undefined): number | null {
  if (!slots) return null;
  return Math.max(slots.cap - slots.registered, 0);
}

/**
 * Step 1: Campus, Team Name, No. of Members. Domain has been dropped as a
 * concept (ideasprint_changes.pdf item 1) — no other information is
 * requested here.
 *
 * Campus slot counts (one slot = one team) are fetched once on mount purely
 * for UX — greying out a full campus in the dropdown before someone fills
 * out the whole form only to be rejected at the end. The authoritative stop
 * is register_team's own cap check (supabase/migrations/0080), so a stale
 * read here (a slot fills between page load and submit) still fails
 * correctly, just later, with the same friendly message.
 */
export function TeamDetailsStep() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>();

  const memberCount = watch("team.memberCount");
  const [slots, setSlots] = useState<Partial<Record<CampusCode, CampusSlots>>>({});

  useEffect(() => {
    let cancelled = false;
    getCampusSlotCounts().then((result) => {
      if (!cancelled) setSlots(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasSlotData = Object.keys(slots).length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Step 1</span>
        <h1 className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">Basic Team Details</h1>
      </div>

      <FormField label="Campus" required error={errors.team?.campus?.message} htmlFor="team-campus">
        <select
          id="team-campus"
          aria-invalid={!!errors.team?.campus}
          className={fieldInputClass}
          defaultValue=""
          {...register("team.campus")}
        >
          <option value="" disabled>
            Select Campus
          </option>
          {CAMPUS_OPTIONS.map((c) => {
            const remaining = remainingSlots(slots[c.code]);
            const full = remaining === 0;
            return (
              <option key={c.code} value={c.code} disabled={full}>
                {c.label}
                {remaining !== null ? (full ? " — Full" : ` — ${remaining} slot${remaining === 1 ? "" : "s"} left`) : ""}
              </option>
            );
          })}
        </select>

        {hasSlotData && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {CAMPUS_OPTIONS.map((c) => {
              const remaining = remainingSlots(slots[c.code]);
              const full = remaining === 0;
              return (
                <span
                  key={c.code}
                  className={cn(
                    "font-mono text-[11px] tracking-[0.1em] uppercase",
                    full ? "text-danger" : "text-ink-faint",
                  )}
                >
                  {c.label}: {remaining === null ? "—" : full ? "Full" : `${remaining} left`}
                </span>
              );
            })}
          </div>
        )}
      </FormField>

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
