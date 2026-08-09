"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { FormField, fieldInputClass } from "@/components/registration/FormField";
import {
  emptyMember,
  GENDER_OPTIONS,
  STAY_OPTIONS,
  YEAR_OF_STUDY_OPTIONS,
  type RegistrationFormValues,
} from "@/lib/registration/schema";
import { cn } from "@/lib/utils";

/**
 * SPEC.md §10 — after Step 1, the Team Lead provides their own info and
 * every member's info. All fields are mandatory for every member, including
 * the lead (who is always member index 0).
 */
export function MemberDetailsStep() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>();

  const memberCount = useWatch<RegistrationFormValues>({ control, name: "team.memberCount" }) as number;
  const { fields, append, remove } = useFieldArray({ control, name: "members" });
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    if (!memberCount) return;
    if (fields.length < memberCount) {
      for (let i = fields.length; i < memberCount; i++) append(emptyMember());
    } else if (fields.length > memberCount) {
      for (let i = fields.length - 1; i >= memberCount; i--) remove(i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberCount]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Step 2</span>
        <h1 className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">Team Member Details</h1>
        <p className="mt-2 font-heading text-sm text-ink-muted">All fields are mandatory for every member.</p>
      </div>

      <div className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const memberErrors = errors.members?.[index];
          const hasError = memberErrors && Object.keys(memberErrors).length > 0;
          const isOpen = openIndex === index;

          return (
            <div key={field.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="flex items-center gap-3 font-heading text-sm text-ink">
                  <span className="font-mono text-xs text-gold">{String(index + 1).padStart(2, "0")}</span>
                  {index === 0 ? "Team Lead (You)" : `Member ${index + 1}`}
                  {hasError && <span className="size-1.5 rounded-full bg-danger" aria-hidden />}
                </span>
                <span className={cn("font-display text-xl text-ink-muted transition-transform", isOpen && "rotate-45")}>
                  +
                </span>
              </button>

              <div
                className="grid transition-all duration-300"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className="grid gap-5 border-t border-border p-5 sm:grid-cols-2">
                    <FormField label="Full Name" required error={memberErrors?.name?.message}>
                      <input
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.name}
                        {...register(`members.${index}.name`)}
                      />
                    </FormField>

                    <FormField label="Registration Number" required error={memberErrors?.regNo?.message}>
                      <input
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.regNo}
                        {...register(`members.${index}.regNo`)}
                      />
                    </FormField>

                    <FormField label="GITAM Mail ID" required error={memberErrors?.gitamEmail?.message}>
                      <input
                        type="email"
                        placeholder="name@student.gitam.edu"
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.gitamEmail}
                        {...register(`members.${index}.gitamEmail`)}
                      />
                    </FormField>

                    <FormField label="Phone Number" required error={memberErrors?.phone?.message}>
                      <input
                        type="tel"
                        placeholder="10-digit mobile number"
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.phone}
                        {...register(`members.${index}.phone`)}
                      />
                    </FormField>

                    <FormField label="Year of Study" required error={memberErrors?.yearOfStudy?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.yearOfStudy}
                        {...register(`members.${index}.yearOfStudy`)}
                      >
                        {YEAR_OF_STUDY_OPTIONS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="School" required error={memberErrors?.school?.message}>
                      <input
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.school}
                        {...register(`members.${index}.school`)}
                      />
                    </FormField>

                    <FormField label="Department" required error={memberErrors?.department?.message}>
                      <input
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.department}
                        {...register(`members.${index}.department`)}
                      />
                    </FormField>

                    <FormField label="Branch" required error={memberErrors?.branch?.message}>
                      <input
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.branch}
                        {...register(`members.${index}.branch`)}
                      />
                    </FormField>

                    <FormField label="Gender" required error={memberErrors?.gender?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.gender}
                        {...register(`members.${index}.gender`)}
                      >
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Stay" required error={memberErrors?.stay?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.stay}
                        {...register(`members.${index}.stay`)}
                      >
                        {STAY_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
