"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { ScrollSmoother, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

/**
 * Wraps `#smooth-wrapper > #smooth-content` (see the public layout) in a
 * single GSAP ScrollSmoother instance so every existing/new ScrollTrigger
 * animation on the public site (Timeline's scrub, every Reveal) inherits
 * smoothed, normalized scroll velocity instead of the browser's native
 * step-y wheel/trackpad scroll. Renders nothing itself — NavBar stays
 * outside the wrapper so its `position: fixed` isn't reinterpreted relative
 * to the transformed smooth-content element.
 *
 * ScrollSmoother translates `#smooth-content` instead of letting the browser
 * scroll it, so nothing that relies on native scrolling reaches the right
 * place on its own — this component owns every in-page jump on the public
 * site:
 *
 *  - Same-page hash links (the footer's `/#faq` while already on Home).
 *    next/link navigates with `history.pushState`, which fires NO
 *    `hashchange` event and leaves `usePathname()` untouched, so neither
 *    signal below sees it. The capture-phase click handler intercepts these
 *    before next/link does (it bails on `defaultPrevented`) and scrolls them
 *    itself.
 *  - Cross-page jumps (`/#faq` clicked from Privacy) and back/forward.
 *    ScrollSmoother caches the content height it measured for the *previous*
 *    page, so scrolling before a re-measure lands thousands of px short —
 *    every jump refreshes ScrollTrigger first.
 *  - Plain route changes, which must land at the top rather than inheriting
 *    the scroll position of the page you came from (the (public) layout
 *    persists across Home/Privacy/Register, and ScrollSmoother bypasses the
 *    browser's own scroll restoration).
 */
export function SmoothScroll() {
  const smootherRef = useRef<ScrollSmoother | null>(null);
  const pathname = usePathname();

  const scrollToHash = useCallback((hash: string, smooth: boolean) => {
    const id = hash.startsWith("#") ? decodeURIComponent(hash.slice(1)) : "";
    const target = id ? document.getElementById(id) : null;
    const smoother = smootherRef.current;

    if (!smoother) {
      // Reduced-motion visitors get no smoother at all — native scrolling is
      // already correct for them.
      if (target) target.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
      else window.scrollTo(0, 0);
      return;
    }

    // Re-measure before computing the target's offset: stale heights (a route
    // change, or images that finished loading after the last refresh) are what
    // made these jumps land in the wrong place.
    ScrollTrigger.refresh();
    if (target) smoother.scrollTo(target, smooth, "top top");
    else smoother.scrollTo(0, smooth);
  }, []);

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

  // Same-page hash links. Capture phase so this runs before next/link's own
  // handler, which returns early once the event is `defaultPrevented`.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a");
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // A different page's anchor is a real navigation — let next/link run and
      // let the pathname effect below do the scrolling once it has mounted.
      if (url.pathname !== window.location.pathname) return;
      if (!url.hash || url.hash === "#") return;
      if (!document.getElementById(decodeURIComponent(url.hash.slice(1)))) return;

      event.preventDefault();
      if (url.hash !== window.location.hash) window.history.pushState(null, "", url.hash);
      scrollToHash(url.hash, true);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [scrollToHash]);

  // Route changes, plus back/forward (`popstate`) and any hash change driven
  // by something other than a link click (`hashchange`).
  useEffect(() => {
    function sync() {
      scrollToHash(window.location.hash, false);
    }

    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [pathname, scrollToHash]);

  return null;
}
