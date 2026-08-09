import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

/**
 * Mount-triggered fade for swapped content (dashboard tab switches) — not a
 * scroll reveal, so it doesn't reuse src/components/motion/Reveal.tsx (that
 * one is ScrollTrigger-driven, tuned for content entering via scroll on the
 * public site, not a same-viewport content swap). Re-runs whenever `dep`
 * changes, e.g. pass the active tab name.
 */
export function useTabFade(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      gsap.fromTo(ref.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
    },
    { dependencies: [dep], scope: ref },
  );

  return ref;
}
