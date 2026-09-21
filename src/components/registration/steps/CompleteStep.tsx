"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { MagneticButton } from "@/components/motion/MagneticButton";
import type { SubmitRegistrationResult } from "@/lib/registration/availability";

interface CompleteStepProps {
  teamName: string;
  result: SubmitRegistrationResult;
}

/** SPEC.md §13 — registration complete: Team ID + per-participant User IDs generated. */
export function CompleteStep({ teamName, result }: CompleteStepProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.set("[data-complete-item]", { opacity: 0, y: 24 });
      gsap.to("[data-complete-item]", { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power3.out" });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="mx-auto flex max-w-2xl flex-col items-center px-6 py-32 text-center">
      <div
        data-complete-item
        className="flex size-16 items-center justify-center rounded-full border border-gold bg-gold/10 font-display text-3xl text-gold"
      >
        ✓
      </div>

      <p data-complete-item className="mt-6 font-mono text-xs tracking-[0.3em] text-gold uppercase">
        Registration Complete
      </p>
      <h1 data-complete-item className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">
        Welcome, {teamName}
      </h1>
      <p data-complete-item className="mt-4 font-heading text-sm text-ink-muted">
        Your team is registered for IdeaSprint 4.0. Sign in with your GITAM Google account to access your Team
        Dashboard.
      </p>

      <div data-complete-item className="mt-10 w-full rounded-xl border border-border bg-surface p-6 text-left">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <span className="font-heading text-xs tracking-[0.3em] text-ink-muted uppercase">Team ID</span>
          <span className="font-mono text-lg text-gold">{result.teamId}</span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <span className="font-heading text-xs tracking-[0.3em] text-ink-muted uppercase">User IDs</span>
          {result.userIds.map((id, i) => (
            <div key={id} className="flex items-center justify-between font-mono text-sm text-ink">
              <span className="text-ink-faint">{i === 0 ? "Team Lead" : `Member ${i + 1}`}</span>
              <span>{id}</span>
            </div>
          ))}
        </div>
      </div>

      <div data-complete-item className="mt-10">
        <MagneticButton href="/login" variant="primary">
          Continue to Login
        </MagneticButton>
      </div>
    </div>
  );
}
