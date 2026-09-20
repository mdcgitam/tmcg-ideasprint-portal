"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { GrainOverlay } from "@/components/motion/GrainOverlay";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { CampusCarousel } from "@/components/motion/CampusCarousel";
import { heroContent, campusSlides } from "@/data/site-config";
import { CURTAIN_START, REVEAL_AT } from "@/lib/hero-timing";

const ALL_HERO_SELECTORS = "[data-hero-brandmark], [data-hero-char], [data-hero-location], [data-hero-cta]";

/**
 * The campus carousel (CampusCarousel.tsx) fades in first — a plain,
 * unhurried crossfade from black, not a camera move or construction effect
 * — then the title characters snap into focus, and the eyebrow/location/CTAs
 * land after. A hard timeout safety-net guarantees every element ends up
 * fully visible even if a GSAP step is ever interrupted, so the CTAs can
 * never get stuck hidden.
 */
export function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const titleWords = heroContent.title.split(" ");

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function forceVisible() {
        gsap.set(ALL_HERO_SELECTORS, { clearProps: "all" });
        gsap.set(imageRef.current, { opacity: 1 });
      }

      if (reduced) {
        forceVisible();
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      tl.set(imageRef.current, { opacity: 0 })
        .set("[data-hero-char]", { opacity: 0, yPercent: 115, filter: "blur(7px)" })
        .set("[data-hero-location]", { opacity: 0, y: 12 })
        .set("[data-hero-cta]", { opacity: 0, y: 12 })
        .set("[data-hero-brandmark]", { opacity: 0, y: 10 })

        // The carousel resolves into view first, on its own — nothing else
        // appears until it's settled.
        .to(imageRef.current, { opacity: 1, duration: 0.9, ease: "power2.out" }, CURTAIN_START)

        // Title, then eyebrow/location/CTAs land over it.
        .to(
          "[data-hero-char]",
          {
            opacity: 1,
            yPercent: 0,
            filter: "blur(0px)",
            duration: 0.55,
            stagger: { each: 0.02, from: "end" },
            ease: "power2.out",
          },
          REVEAL_AT,
        )
        .to("[data-hero-brandmark]", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, REVEAL_AT)
        .to("[data-hero-location]", { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, REVEAL_AT + 0.15)
        .to("[data-hero-cta]", { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }, REVEAL_AT + 0.3);

      // Safety net: a plain setTimeout (not GSAP's own rAF-driven clock) so
      // visibility is guaranteed on real wall-clock time even if the ticker
      // itself is throttled (backgrounded tab, low-power mode, etc.) —
      // nothing on this page may depend on GSAP finishing to become visible.
      const safetyTimer = window.setTimeout(forceVisible, (REVEAL_AT + 1.5) * 1000);

      // Continuous cursor-reactive depth (prompt.md §8 "hover depth /
      // cursor-based movement") once the sequence has settled — a small,
      // direct translate (no scale, no perspective change) on the campus
      // carousel.
      const quickImage = {
        x: gsap.quickTo(imageRef.current, "x", { duration: 0.8, ease: "power3.out" }),
        y: gsap.quickTo(imageRef.current, "y", { duration: 0.8, ease: "power3.out" }),
      };

      function handlePointerMove(e: PointerEvent) {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        quickImage.x(relX * 8);
        quickImage.y(relY * 8);
      }

      rootRef.current?.addEventListener("pointermove", handlePointerMove);

      return () => {
        window.clearTimeout(safetyTimer);
        rootRef.current?.removeEventListener("pointermove", handlePointerMove);
      };
    },
    { scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      id="hero"
      className="relative isolate flex min-h-[100svh] flex-col justify-between overflow-hidden bg-void px-6 pt-28 pb-10 sm:px-10 lg:px-16"
    >
      {/* Campus imagery: the multi-campus carousel (CampusCarousel.tsx),
          fading in as one plain crossfade from black — no camera move, no
          per-building construction effect. */}
      <div
        ref={imageRef}
        data-hero-image
        className="pointer-events-none absolute -inset-2 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--color-surface-2),_var(--color-void))] will-change-transform"
      >
        <CampusCarousel slides={campusSlides} />

        {/* Film grain disguises the source photos' compression as an
            intentional cinematic grade instead of a stretched, soft image. */}
        <GrainOverlay opacity={0.06} />

        {/* Vignette + wash for text legibility, not a near-opaque curtain over the photo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_var(--color-void)_92%)] opacity-70" />
        <div className="absolute inset-0 bg-void/30" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />
      </div>

      <div className="flex w-full flex-1 flex-col items-center px-2 text-center">
        <p
          data-hero-brandmark
          className="mt-2 w-full max-w-2xl px-2 font-hero-label text-xs tracking-[0.2em] text-ink uppercase sm:mt-4 sm:tracking-[0.35em] sm:text-sm"
        >
          {heroContent.eyebrow}
        </p>

        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <h1 className="w-full text-center font-display text-[clamp(2.4rem,11.5vw,9.75rem)] leading-[0.9] tracking-wide text-ink">
            {titleWords.map((word, wi) => (
              <span key={wi}>
                {wi > 0 && " "}
                {word.split("").map((char, ci) => (
                  <span key={ci} className="inline-block overflow-hidden py-[0.05em] align-top">
                    <span data-hero-char className="inline-block will-change-transform">
                      {char}
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p data-hero-location className="mt-6 w-full font-hero-label text-base tracking-[0.2em] text-ink uppercase sm:tracking-[0.3em] sm:text-lg">
            GITAM (Deemed to be University)
          </p>

          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
            <div data-hero-cta>
              <MagneticButton href="/register" variant="primary" className="font-hero-label">
                {heroContent.registerCtaLabel}
              </MagneticButton>
            </div>
            <div data-hero-cta>
              <MagneticButton
                href="/login"
                variant="secondary"
                cursorKind="interactive"
                className="font-hero-label"
              >
                {heroContent.loginCtaLabel}
              </MagneticButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
