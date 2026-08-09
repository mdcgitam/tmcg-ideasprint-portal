"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "@/lib/gsap";
import { acts } from "@/data/acts";

/**
 * Persistent chapter indicator that finally surfaces the "Act 0X" structure
 * already threaded through every section's eyebrow label as one continuous,
 * always-visible device — desktop gets a vertical rail on the right edge,
 * mobile collapses to a slim top progress line. Purely a wayfinding UI: the
 * highlight state changes via a plain CSS transition (not a GSAP tween), so
 * it isn't gated behind prefersReducedMotion the way decorative motion is.
 *
 * Homepage-only, but mounted in the public layout (outside the
 * ScrollSmoother wrapper) rather than in page.tsx — `position: fixed`
 * inside `#smooth-content` would be reinterpreted relative to that
 * transformed ancestor instead of the viewport, same reasoning as NavBar.
 * Checks the route itself, mirroring NavBar's own `isHome` pattern.
 */
export function ActRail() {
  const isHome = usePathname() === "/";
  const [activeId, setActiveId] = useState(acts[0].id);

  useGSAP(() => {
    if (!isHome) return;

    const triggers = acts.map((act, i) => {
      const target = document.getElementById(act.targetId);
      if (!target) return null;

      const endEl = act.endTargetId
        ? document.getElementById(act.endTargetId)
        : (document.getElementById(acts[i + 1]?.targetId ?? "") ?? null);

      return ScrollTrigger.create({
        trigger: target,
        endTrigger: endEl ?? target,
        start: "top center",
        end: endEl ? "top center" : "bottom center",
        onToggle: (self) => {
          if (self.isActive) setActiveId(act.id);
        },
      });
    });

    return () => triggers.forEach((t) => t?.kill());
  }, [isHome]);

  if (!isHome) return null;

  const activeIndex = acts.findIndex((a) => a.id === activeId);

  return (
    <>
      {/* Desktop: vertical rail, right edge */}
      <nav
        aria-label="Page sections"
        className="fixed top-1/2 right-6 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex"
      >
        {acts.map((act) => {
          const active = act.id === activeId;
          return (
            <a
              key={act.id}
              href={`#${act.targetId}`}
              className="group flex items-center gap-2.5"
              aria-current={active ? "true" : undefined}
            >
              <span
                className={`font-mono text-[10px] tracking-[0.2em] uppercase transition-all duration-300 ${
                  active
                    ? "translate-x-0 text-gold opacity-100"
                    : "translate-x-1 text-ink-faint opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                }`}
              >
                {act.number} — {act.label}
              </span>
              <span
                className={`rounded-full transition-all duration-300 ${
                  active
                    ? "h-2.5 w-2.5 bg-gold shadow-[0_0_10px_1px_rgba(201,162,39,0.8)]"
                    : "h-1.5 w-1.5 bg-border-strong group-hover:bg-ink-faint"
                }`}
              />
            </a>
          );
        })}
      </nav>

      {/* Mobile/tablet: slim top progress line */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-40 h-[2px] bg-border/60 lg:hidden">
        <div
          className="h-full bg-gold transition-[width] duration-500 ease-out"
          style={{ width: `${((activeIndex + 1) / acts.length) * 100}%` }}
        />
      </div>
    </>
  );
}
