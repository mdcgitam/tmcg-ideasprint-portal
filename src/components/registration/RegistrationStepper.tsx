"use client";

import { useState } from "react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProgressRail } from "./ProgressRail";
import { GuidelinesStep } from "./steps/GuidelinesStep";
import { TeamDetailsStep } from "./steps/TeamDetailsStep";
import { MemberDetailsStep } from "./steps/MemberDetailsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { CompleteStep } from "./steps/CompleteStep";
import { emptyMember, MIN_TEAM_SIZE, registrationSchema, type RegistrationFormValues } from "@/lib/registration/schema";
import {
  findInTeamDuplicates,
  submitRegistration,
  type SubmitRegistrationResult,
} from "@/lib/registration/availability";

const STEP_LABELS = ["Guidelines", "Team", "Members", "Review"] as const;

export function RegistrationStepper() {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitRegistrationResult | null>(null);

  const methods = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    // Validation is driven manually via trigger() per step (goNext below) —
    // "onBlur" mode was firing an extra validation pass exactly when focus
    // moved from a just-checked checkbox to the Continue button, which
    // reliably swallowed that click (React re-rendering mid-gesture lost the
    // click event). Manual control avoids that race entirely.
    mode: "onSubmit",
    defaultValues: {
      guidelinesAcknowledged: false,
      team: { teamName: "", domainId: "", memberCount: MIN_TEAM_SIZE },
      members: Array.from({ length: MIN_TEAM_SIZE }, emptyMember),
    },
  });

  const { trigger, handleSubmit, setError, getValues } = methods;

  async function goNext() {
    let valid = false;

    if (stepIndex === 0) {
      valid = await trigger("guidelinesAcknowledged");
    } else if (stepIndex === 1) {
      valid = await trigger(["team.teamName", "team.domainId", "team.memberCount"]);
    } else if (stepIndex === 2) {
      valid = await trigger("members");
      if (valid) {
        const dupes = findInTeamDuplicates(getValues("members"));
        for (const [path, message] of Object.entries(dupes)) {
          setError(path as FieldPath<RegistrationFormValues>, { message });
        }
        valid = Object.keys(dupes).length === 0;
      }
    }

    if (valid) setStepIndex((i) => Math.min(i + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function onSubmit(values: RegistrationFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    const outcome = await submitRegistration({ team: values.team, members: values.members });
    if (outcome.success) {
      setResult(outcome);
    } else {
      setSubmitError(outcome.message);
    }
    setSubmitting(false);
  }

  if (result) {
    return <CompleteStep teamName={getValues("team.teamName")} result={result} />;
  }

  const isLastStep = stepIndex === STEP_LABELS.length - 1;

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="mx-auto max-w-3xl px-6 pt-28 pb-24 sm:px-10"
      >
        <ProgressRail steps={STEP_LABELS} activeIndex={stepIndex} />

        <div className="mt-14">
          {stepIndex === 0 && <GuidelinesStep />}
          {stepIndex === 1 && <TeamDetailsStep />}
          {stepIndex === 2 && <MemberDetailsStep />}
          {stepIndex === 3 && <ReviewStep />}
        </div>

        {submitError && (
          <p className="mt-8 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-heading text-sm text-red-300">
            {submitError}
          </p>
        )}

        <div className="mt-14 flex items-center justify-between border-t border-border pt-6">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="font-heading text-sm text-ink-muted transition-colors hover:text-ink"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}

          {!isLastStep ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-full bg-gold px-8 py-3 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(onSubmit)()}
              className="rounded-full bg-gold px-8 py-3 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Complete Registration"}
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
