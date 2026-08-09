"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { WILL_PLAY_IDENT, markIdentSeen } from "@/lib/ident-timing";

/**
 * Cold open before the Hero curtain even parts — the three organizer marks
 * converge and pulse on black, like a studio logo bump before a film
 * starts. Plays once per browser session (see ident-timing.ts), skippable,
 * and never blocks: if it doesn't play, Hero's own CURTAIN_START collapses
 * back to its short default so there's no dead air.
 *
 * Renders visible by default (matching SSR, where sessionStorage doesn't
 * exist) and corrects to hidden in a layout effect — pre-paint, so repeat
 * visits within the same session don't see it flash — rather than branching
 * the initial render on WILL_PLAY_IDENT directly, which would mismatch
 * between server and client.
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
      markIdentSeen();

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
    markIdentSeen();
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
        style={{ filter: "url(#logo-key-black)" }}
        className="h-9 w-auto sm:h-14"
      />
      <span className="font-display text-xl text-ink-faint sm:text-2xl">×</span>
      <Image
        data-ident-logo
        src="/assets/brand/tmcg-logo.jpeg"
        alt="TMCG"
        width={601}
        height={216}
        style={{ filter: "url(#logo-key-black)" }}
        className="h-9 w-auto sm:h-14"
      />
      <span className="font-display text-xl text-ink-faint sm:text-2xl">×</span>
      <Image
        data-ident-logo
        src="/assets/brand/mdc-logo.png"
        alt="MDC"
        width={512}
        height={257}
        className="h-9 w-auto sm:h-14"
      />
    </div>
  );
}
