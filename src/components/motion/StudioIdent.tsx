"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { WILL_PLAY_IDENT } from "@/lib/ident-timing";

/**
 * Cold open before the Hero curtain even parts — the three organizer marks
 * converge and pulse on black, like a studio logo bump before a film
 * starts. Plays on every full page load/refresh (see ident-timing.ts),
 * skippable, and never blocks: if it doesn't play (reduced motion), Hero's
 * own CURTAIN_START collapses back to its short default so there's no dead
 * air.
 *
 * Renders visible by default (matching SSR, where sessionStorage doesn't
 * exist) and corrects to hidden in a layout effect for repeat visits within
 * the same session — this is deliberate, not an oversight: the alternative
 * (start hidden, reveal once we can check sessionStorage) leaves a gap on
 * *every* load, including the common first-time case, where nothing covers
 * Hero yet and it flashes through before the ident's backdrop appears.
 * Showing the opaque backdrop immediately means Hero is never left
 * uncovered; the only remaining risk was the *logos* briefly rendering at
 * their finished (opacity 1, full scale) state before GSAP's `.set()` runs
 * — fixed below by giving them that hidden starting state directly as
 * inline styles, correct from the very first paint, not applied moments
 * later by JS.
 */
export function StudioIdent() {
  const isHome = usePathname() === "/";
  const [visible, setVisible] = useState(isHome);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isHome || !WILL_PLAY_IDENT) setVisible(false);
  }, [isHome]);

  useGSAP(
    () => {
      if (!isHome || !WILL_PLAY_IDENT || !rootRef.current) return;

      gsap.timeline({ onComplete: () => setVisible(false) })
        .set("[data-ident-logo]", { opacity: 0, scale: 0.7 })
        .to("[data-ident-logo]", { opacity: 1, scale: 1, duration: 0.5, stagger: 0.15, ease: "power2.out" })
        .to("[data-ident-logo]", { scale: 1.06, duration: 0.3, ease: "power1.inOut", yoyo: true, repeat: 1 }, "+=0.1")
        .to(rootRef.current, { opacity: 0, duration: 0.35, ease: "power2.in" }, "+=0.05");
    },
    { scope: rootRef },
  );

  function skip() {
    if (rootRef.current) gsap.killTweensOf([rootRef.current, ...rootRef.current.querySelectorAll("[data-ident-logo]")]);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
      onClick={skip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          skip();
        }
      }}
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center gap-4 bg-void sm:gap-6"
    >
      <Image
        data-ident-logo
        src="/assets/brand/gitam-logo.jpeg"
        alt="GITAM"
        width={1212}
        height={532}
        style={{ filter: "url(#logo-key-black)", opacity: 0, transform: "scale(0.7)" }}
        className="h-9 w-auto sm:h-14"
      />
      <span
        data-ident-logo
        className="font-display text-xl text-ink-faint sm:text-2xl"
        style={{ opacity: 0, transform: "scale(0.7)" }}
      >
        ×
      </span>
      <Image
        data-ident-logo
        src="/assets/brand/tmcg-logo.jpeg"
        alt="TMCG"
        width={601}
        height={216}
        style={{ filter: "url(#logo-key-black)", opacity: 0, transform: "scale(0.7)" }}
        className="h-9 w-auto sm:h-14"
      />
      <span
        data-ident-logo
        className="font-display text-xl text-ink-faint sm:text-2xl"
        style={{ opacity: 0, transform: "scale(0.7)" }}
      >
        ×
      </span>
      <Image
        data-ident-logo
        src="/assets/brand/mdc-logo.png"
        alt="MDC"
        width={512}
        height={257}
        style={{ opacity: 0, transform: "scale(0.7)" }}
        className="h-9 w-auto sm:h-14"
      />
    </div>
  );
}
