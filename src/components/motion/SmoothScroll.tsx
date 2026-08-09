"use client";

import { useGSAP } from "@gsap/react";
import { ScrollSmoother, prefersReducedMotion } from "@/lib/gsap";

/**
 * Wraps `#smooth-wrapper > #smooth-content` (see the public layout) in a
 * single GSAP ScrollSmoother instance so every existing/new ScrollTrigger
 * animation on the public site (Domains' pin, Timeline's scrub, every
 * Reveal) inherits smoothed, normalized scroll velocity instead of the
 * browser's native step-y wheel/trackpad scroll. Renders nothing itself —
 * NavBar stays outside the wrapper so its `position: fixed` isn't
 * reinterpreted relative to the transformed smooth-content element.
 */
export function SmoothScroll() {
  useGSAP(() => {
    if (prefersReducedMotion()) return;

    const smoother = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.2,
      normalizeScroll: true,
      ignoreMobileResize: true,
    });

    return () => smoother.kill();
  }, []);

  return null;
}
