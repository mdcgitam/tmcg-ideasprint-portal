"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { FormField, fieldInputClass } from "@/components/registration/FormField";
import {
  GENDER_OPTIONS,
  GRADUATION_OPTIONS,
  SCHOOL_OPTIONS,
  STAY_OPTIONS,
  branchesFor,
  departmentsFor,
  emptyMember,
  programsFor,
  yearsFor,
  type RegistrationFormValues,
} from "@/lib/registration/schema";
import { cn } from "@/lib/utils";

/**
 * SPEC.md §10 + Registration Page Restructuring — after Step 1 the Team Lead
 * provides their own info and every member's info. All fields are mandatory.
 * Graduation → Program → Year of Study and School → Department → Branch are
 * dependent selects: picking a parent narrows the child, and changing a parent
 * resets its children back to "Select …".
 */
export function MemberDetailsStep() {
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = useFormContext<RegistrationFormValues>();

  const memberCount = useWatch<RegistrationFormValues>({ control, name: "team.memberCount" }) as number;
  const members = useWatch({ control, name: "members" }) as RegistrationFormValues["members"];
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

  /** Set one member sub-field (dynamic path — cast mirrors RegistrationStepper's setError use). */
  const set = (index: number, field: string, value: string) =>
    setValue(`members.${index}.${field}` as FieldPath<RegistrationFormValues>, value, {
      shouldValidate: true,
      shouldDirty: true,
    });

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
          const m = members?.[index] ?? emptyMember();

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

              <div className="grid transition-all duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
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
                        placeholder="2023…"
                        aria-invalid={!!memberErrors?.regNo}
                        {...register(`members.${index}.regNo`)}
                      />
                    </FormField>

                    <FormField label="GITAM Email" required error={memberErrors?.gitamEmail?.message}>
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
                        inputMode="numeric"
                        placeholder="10-digit mobile number"
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.phone}
                        {...register(`members.${index}.phone`)}
                      />
                    </FormField>

                    <FormField label="Graduation" required error={memberErrors?.graduation?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.graduation}
                        value={m.graduation}
                        onChange={(e) => {
                          set(index, "graduation", e.target.value);
                          set(index, "program", "");
                          set(index, "yearOfStudy", "");
                        }}
                      >
                        <option value="" disabled>
                          Select Graduation
                        </option>
                        {GRADUATION_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Program" required error={memberErrors?.program?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.program}
                        value={m.program}
                        disabled={!m.graduation}
                        onChange={(e) => {
                          set(index, "program", e.target.value);
                          set(index, "yearOfStudy", "");
                        }}
                      >
                        <option value="" disabled>
                          Select Program
                        </option>
                        {programsFor(m.graduation).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Year of Study" required error={memberErrors?.yearOfStudy?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.yearOfStudy}
                        value={m.yearOfStudy}
                        disabled={!m.program}
                        onChange={(e) => set(index, "yearOfStudy", e.target.value)}
                      >
                        <option value="" disabled>
                          Select Year of Study
                        </option>
                        {yearsFor(m.program).map((y) => (
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
                        value={m.school}
                        onChange={(e) => {
                          set(index, "school", e.target.value);
                          set(index, "department", "");
                          set(index, "branch", "");
                        }}
                      >
                        <option value="" disabled>
                          Select School
                        </option>
                        {SCHOOL_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Department" required error={memberErrors?.department?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.department}
                        value={m.department}
                        disabled={!m.school}
                        onChange={(e) => {
                          set(index, "department", e.target.value);
                          set(index, "branch", "");
                        }}
                      >
                        <option value="" disabled>
                          Select Department
                        </option>
                        {departmentsFor(m.school).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Branch" required error={memberErrors?.branch?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.branch}
                        value={m.branch}
                        disabled={!m.department}
                        onChange={(e) => set(index, "branch", e.target.value)}
                      >
                        <option value="" disabled>
                          Select Branch
                        </option>
                        {branchesFor(m.department).map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Gender" required error={memberErrors?.gender?.message}>
                      <select
                        className={fieldInputClass}
                        aria-invalid={!!memberErrors?.gender}
                        value={m.gender}
                        onChange={(e) => set(index, "gender", e.target.value)}
                      >
                        <option value="" disabled>
                          Select Gender
                        </option>
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
                        value={m.stay}
                        onChange={(e) => set(index, "stay", e.target.value)}
                      >
                        <option value="" disabled>
                          Select Stay
                        </option>
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
