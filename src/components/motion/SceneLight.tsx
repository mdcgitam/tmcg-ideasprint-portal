"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * One shared, cheap ambient wash behind the whole page — crossfades hue
 * between the three brand colors (gold → MDC blue → GITAM teal) as the user
 * scrolls through the Acts, so the page reads as moving between scenes in
 * one continuous film rather than nine independently-styled cards. A single
 * fixed `screen`-blended radial gradient, not a per-section reimplementation.
 *
 * Homepage-only, mounted in the public layout outside the ScrollSmoother
 * wrapper — `position: fixed` inside `#smooth-content` would be
 * reinterpreted relative to that transformed ancestor instead of the
 * viewport, same reasoning as NavBar.
 */
export function SceneLight() {
  const isHome = usePathname() === "/";
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!isHome || !ref.current || prefersReducedMotion()) return;

      const styles = getComputedStyle(document.documentElement);
      const gold = styles.getPropertyValue("--color-gold").trim();
      const mdc = styles.getPropertyValue("--color-mdc").trim();
      const gitam = styles.getPropertyValue("--color-gitam").trim();

      gsap.set(ref.current, { backgroundColor: gold });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#smooth-content",
          start: "top top",
          end: "bottom bottom",
          scrub: 1,
        },
      });

      tl.to(ref.current, { backgroundColor: mdc, duration: 0.4, ease: "none" }, 0)
        .to(ref.current, { backgroundColor: gitam, duration: 0.35, ease: "none" }, 0.4)
        .to(ref.current, { backgroundColor: gold, duration: 0.25, ease: "none" }, 0.75);

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    { dependencies: [isHome] },
  );

  if (!isHome) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 opacity-[0.07] mix-blend-screen"
      style={{
        maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
      }}
    />
  );
}
