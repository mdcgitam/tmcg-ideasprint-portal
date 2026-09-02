"use client";

import { useFormContext } from "react-hook-form";
import type { RegistrationFormValues } from "@/lib/registration/schema";
import { registrationGuidelines } from "@/data/site-config";

/**
 * SPEC.md §8 — guidelines must be shown and acknowledged before the user can
 * proceed; registration cannot continue without it.
 */
export function GuidelinesStep() {
  const {
    register,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Before You Begin</span>
        <h1 className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">Registration Guidelines</h1>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 font-heading text-sm leading-relaxed text-ink-muted">
        {registrationGuidelines.content}
      </div>

      <div className="rounded-xl border border-gold/40 bg-gold/10 p-6">
        <p className="font-heading text-sm font-semibold text-gold">{registrationGuidelines.nocNotice}</p>
        <p className="mt-3 font-heading text-sm text-ink-muted">
          {registrationGuidelines.nocFormUrl ? (
            <>
              Download the NOC form for your parents/guardian to fill and sign:{" "}
              <a href={registrationGuidelines.nocFormUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                NOC Form (PDF)
              </a>
              . You can submit either the physical signed copy or an uploaded online copy from your team dashboard.
            </>
          ) : (
            "The NOC form link/PDF will be provided by the organizers closer to the event. You'll be able to submit either the physical signed copy or an uploaded online copy from your team dashboard."
          )}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-gold/50">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-gold"
          {...register("guidelinesAcknowledged")}
        />
        <span className="font-heading text-sm text-ink">
          I have read and acknowledge the registration guidelines, including the mandatory NOC requirement, and I
          confirm the information I submit will be accurate.
        </span>
      </label>
      {errors.guidelinesAcknowledged && (
        <p className="-mt-4 font-mono text-xs text-danger">{errors.guidelinesAcknowledged.message}</p>
      )}
    </div>
  );
}
