"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { ScrollSmoother, prefersReducedMotion } from "@/lib/gsap";

/**
 * Wraps `#smooth-wrapper > #smooth-content` (see the public layout) in a
 * single GSAP ScrollSmoother instance so every existing/new ScrollTrigger
 * animation on the public site (Timeline's scrub, every Reveal) inherits
 * smoothed, normalized scroll velocity instead of the browser's native
 * step-y wheel/trackpad scroll. Renders nothing itself — NavBar stays
 * outside the wrapper so its `position: fixed` isn't reinterpreted relative
 * to the transformed smooth-content element.
 *
 * The (public) layout (Home, Privacy, Register) persists across navigation
 * between those pages, so this component only mounts once — without the
 * effect below, ScrollSmoother's scroll position carries over untouched from
 * whatever page you came from (Privacy Policy opening "scrolled down" from
 * Home), and plain `<a href="#section">` fragment jumps don't move
 * ScrollSmoother's transformed content at all (footer section links
 * silently doing nothing on any page other than Home). Re-sync explicitly on
 * every route change and every hash change instead of relying on native
 * browser scroll-restoration, which ScrollSmoother bypasses.
 */
export function SmoothScroll() {
  const smootherRef = useRef<ScrollSmoother | null>(null);
  const pathname = usePathname();

  useGSAP(() => {
    if (prefersReducedMotion()) return;

    const smoother = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.2,
      normalizeScroll: true,
      ignoreMobileResize: true,
    });
    smootherRef.current = smoother;

    return () => {
      smoother.kill();
      smootherRef.current = null;
    };
  }, []);

  useEffect(() => {
    function syncScrollPosition() {
      const hash = window.location.hash;
      const target = hash ? document.querySelector(hash) : null;

      if (smootherRef.current) {
        smootherRef.current.scrollTo(target ?? 0, false);
      } else if (target) {
        target.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
      }
    }

    // Same-route hash-only navigation (footer link clicked while already on
    // that page) doesn't change `pathname`, so it needs its own listener —
    // `hashchange` fires for pushState-driven fragment changes too, not only
    // back/forward.
    syncScrollPosition();
    window.addEventListener("hashchange", syncScrollPosition);
    return () => window.removeEventListener("hashchange", syncScrollPosition);
  }, [pathname]);

  return null;
}
