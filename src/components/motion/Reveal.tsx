"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** stagger reveal across direct children instead of the container as a whole */
  stagger?: boolean;
  y?: number;
  delay?: number;
  duration?: number;
}

/**
 * Shared scroll-reveal primitive so every section enters with the same
 * restrained fade/rise language — bespoke sections (Timeline, Prizes) layer
 * their own choreography on top rather than reinventing entrance motion.
 * Always renders a div — wrap in a semantic <section> at the call site.
 */
export function Reveal({ children, className, stagger = false, y = 40, delay = 0, duration = 0.9 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      if (prefersReducedMotion()) return;

      const targets = stagger ? gsap.utils.toArray<HTMLElement>(ref.current.children) : ref.current;

      gsap.set(targets, { opacity: 0, y });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger: stagger ? 0.1 : 0,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 82%",
          once: true,
        },
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
