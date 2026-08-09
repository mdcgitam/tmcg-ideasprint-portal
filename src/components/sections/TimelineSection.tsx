"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { timeline } from "@/data/site-config";

interface Step {
  id: string;
  kicker: string;
  big: string;
  unit?: string;
  detail: string;
}

function toStep(item: (typeof timeline)[number]): Step {
  if (!item.duration) {
    return { id: item.id, kicker: "Phase 2", big: item.label.toUpperCase(), detail: item.detail };
  }
  const [value, ...unitParts] = item.duration.split(" ");
  return { id: item.id, kicker: item.label, big: value, unit: unitParts.join(" ").toUpperCase(), detail: item.detail };
}

const steps: Step[] = timeline.map(toStep);

/**
 * Act 3 — The Journey (prompt.md §11, §43). A connected roadmap rather than
 * a pinned cycle of giant numbers or another card row (which would just
 * repeat the Domains pattern) — Round 1 → Round 2 → Grand Finale joined by a
 * line that draws in as the section scrolls through view. No pinning, no
 * scroll-jacking — just a smooth, lightly-scrubbed reveal.
 */
export function TimelineSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current || prefersReducedMotion()) return;

      const dots = gsap.utils.toArray<HTMLElement>("[data-step-dot]", sectionRef.current);
      const contents = gsap.utils.toArray<HTMLElement>("[data-step-content]", sectionRef.current);

      // Dots/content start fully hidden (not a faint preview at their final
      // position) — nothing should be visible ahead of where the scroll
      // flow has actually reached.
      gsap.set(lineRef.current, { scaleX: 0 });
      gsap.set(dots, { scale: 0.4, opacity: 0 });
      gsap.set(contents, { opacity: 0, y: 24 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          // Starts the instant the section's top touches the viewport's
          // bottom edge (i.e. the moment it first appears) and completes
          // when its top reaches the viewport's top — the point where the
          // section stops sliding in and starts sliding back out. The whole
          // reveal must be finished by then, not partway through leaving.
          start: "top bottom",
          end: "top top",
          scrub: 0.4,
        },
      });

      tl.to(lineRef.current, { scaleX: 1, ease: "none", duration: 1 }, 0);

      // Back-to-back slices, weighted so the first step gets a generous,
      // gentle window and the rest share what's left — the Grand Finale's
      // slice is short (renders quickly once reached) but still ends
      // exactly at 1, so it's fully in by the time the section starts to
      // leave, not partway through leaving.
      const weights = dots.map((_, i) => (i === 0 ? 2 : 1));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let cursor = 0;
      dots.forEach((dot, i) => {
        const duration = weights[i] / totalWeight;
        const start = cursor;
        cursor += duration;
        tl.to(dot, { scale: 1, opacity: 1, duration, ease: "power2.out" }, start).to(
          contents[i],
          { opacity: 1, y: 0, duration, ease: "power2.out" },
          start,
        );
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="journey"
      className="border-t border-border bg-surface px-6 py-28 sm:px-10 lg:px-16"
    >
      <div className="mx-auto mb-20 max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 3 — The Journey</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-8xl">THE JOURNEY</h2>
      </div>

      <div className="mx-auto max-w-5xl">
        {/* the road: base line + gold progress line + node dots */}
        <div className="relative mb-10 h-4">
          <div className="absolute top-1/2 right-2 left-2 h-px -translate-y-1/2 bg-border-strong" />
          <div
            ref={lineRef}
            className="absolute top-1/2 right-2 left-2 h-px origin-left -translate-y-1/2 bg-gold"
          />
          <div className="relative flex items-center justify-between">
            {steps.map((step) => (
              <span
                key={step.id}
                data-step-dot
                className="size-4 rounded-full border-2 border-gold bg-void shadow-[0_0_16px_-2px_rgba(201,162,39,0.8)]"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between sm:gap-6">
          {steps.map((step) => (
            <div key={step.id} data-step-content className="text-left sm:max-w-[16rem]">
              <span className="font-heading text-xs tracking-[0.3em] text-ink-muted uppercase">{step.kicker}</span>
              <p className="mt-3 font-display text-4xl tracking-wide text-ink sm:text-5xl">
                {step.big}
                {step.unit && <span className="ml-2 align-middle font-heading text-base text-gold sm:text-lg">{step.unit}</span>}
              </p>
              <p className="mt-3 max-w-[16rem] font-heading text-sm text-ink-muted">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
