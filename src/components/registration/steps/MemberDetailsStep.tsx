"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { FormField, fieldInputClass } from "@/components/registration/FormField";
import {
  BRANCH_OPTIONS,
  emptyMember,
  GENDER_OPTIONS,
  SCHOOL_LABELS,
  SCHOOL_VALUES,
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
    setValue,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>();

  const memberCount = useWatch<RegistrationFormValues>({ control, name: "team.memberCount" }) as number;
  const memberValues = useWatch({ control, name: "members" });
  const { fields, append, remove } = useFieldArray({ control, name: "members" });
  const [openIndex, setOpenIndex] = useState(0);
  const [customBranchIds, setCustomBranchIds] = useState<Set<string>>(new Set());

  function selectBranch(index: number, fieldId: string, value: string) {
    if (value === "Other") {
      setCustomBranchIds((prev) => new Set(prev).add(fieldId));
      setValue(`members.${index}.branch`, "", { shouldValidate: true });
    } else {
      setCustomBranchIds((prev) => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
      setValue(`members.${index}.branch`, value, { shouldValidate: true });
    }
  }

  function resetBranchToList(index: number, fieldId: string) {
    setCustomBranchIds((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
    setValue(`members.${index}.branch`, "", { shouldValidate: true });
  }

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
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.school}
                        {...register(`members.${index}.school`)}
                      >
                        {SCHOOL_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {SCHOOL_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Branch" required error={memberErrors?.branch?.message}>
                      {customBranchIds.has(field.id) ? (
                        <div className="flex flex-col gap-2">
                          <input
                            className={fieldInputClass}
                            placeholder="Enter your branch"
                            aria-invalid={!!memberErrors?.branch}
                            {...register(`members.${index}.branch`)}
                          />
                          <button
                            type="button"
                            onClick={() => resetBranchToList(index, field.id)}
                            className="self-start font-mono text-xs text-gold underline underline-offset-2"
                          >
                            Choose from list instead
                          </button>
                        </div>
                      ) : (
                        <select
                          className={fieldInputClass}
                          aria-invalid={!!memberErrors?.branch}
                          value={
                            BRANCH_OPTIONS.includes(memberValues?.[index]?.branch as (typeof BRANCH_OPTIONS)[number])
                              ? (memberValues?.[index]?.branch ?? "")
                              : ""
                          }
                          onChange={(e) => selectBranch(index, field.id, e.target.value)}
                        >
                          <option value="" disabled>
                            Select branch
                          </option>
                          {BRANCH_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                          <option value="Other">Other</option>
                        </select>
                      )}
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
