"use client";

import { useFormContext } from "react-hook-form";
import type { RegistrationFormValues } from "@/lib/registration/schema";

export function ReviewStep() {
  const { getValues } = useFormContext<RegistrationFormValues>();
  const values = getValues();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Step 3</span>
        <h1 className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">Review &amp; Submit</h1>
        <p className="mt-2 font-heading text-sm text-ink-muted">
          Confirm everything below is correct — you can go back to fix any field before submitting.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-heading text-xs tracking-[0.3em] text-gold uppercase">Team</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReviewRow label="Team Name" value={values.team.teamName} />
          <ReviewRow label="Team Size" value={`${values.team.memberCount} members`} />
        </dl>
      </div>

      <div className="flex flex-col gap-4">
        {values.members.map((member, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-heading text-xs tracking-[0.3em] text-gold uppercase">
              {i === 0 ? "Team Lead" : `Member ${i + 1}`}
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <ReviewRow label="Name" value={member.name} />
              <ReviewRow label="Reg No" value={member.regNo} />
              <ReviewRow label="GITAM Mail" value={member.gitamEmail} />
              <ReviewRow label="Phone" value={member.phone} />
              <ReviewRow label="Year" value={member.yearOfStudy} />
              <ReviewRow label="School" value={member.school} />
              <ReviewRow label="Department" value={member.department} />
              <ReviewRow label="Branch" value={member.branch} />
              <ReviewRow label="Gender" value={member.gender} />
              <ReviewRow label="Stay" value={member.stay} />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] tracking-wide text-ink-faint uppercase">{label}</dt>
      <dd className="font-heading text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}
