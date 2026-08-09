"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ParticleField } from "@/components/motion/ParticleField";
import { GrainOverlay } from "@/components/motion/GrainOverlay";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { BuildingBlueprint } from "@/components/motion/BuildingBlueprint";
import { heroContent } from "@/data/site-config";
import { CustomEase } from "@/lib/gsap";
import { CURTAIN_START, CURTAIN_DURATION, REVEAL_AT } from "@/lib/hero-timing";

const ALL_HERO_SELECTORS = "[data-hero-brandmark], [data-hero-char], [data-hero-location], [data-hero-cta]";

// A camera dolly has weight — it doesn't ease off with pure math, it settles
// with a faint overshoot, like the operator's own hand catching the move.
// Guarded the same way gsap.ts gates its own registerPlugin call — this
// runs at module-eval time, which also happens during SSR, where GSAP
// plugins are never registered (no `window`) and CustomEase.create() would
// otherwise warn ("Please gsap.registerPlugin(CustomEase)") on every build.
if (typeof window !== "undefined") {
  CustomEase.create("cameraPush", "M0,0 C0.32,0.01 0.12,1.02 1,1");
}

const DUOTONE_FILTER = "grayscale(0.85) sepia(0.2) hue-rotate(165deg) saturate(2) brightness(0.85) contrast(1.15)";
const REALITY_FILTER = "grayscale(0) sepia(0) hue-rotate(0deg) saturate(1.12) brightness(1) contrast(1.08)";

/**
 * Act 01 — Arrival (prompt.md §43). IDEA → ENGINEERING → TECHNOLOGY →
 * REALITY, one continuous shot: the ident's point of light holds, then the
 * campus building's own architecture draws itself in as line art
 * (BuildingBlueprint.tsx — hand-traced, not live edge-detection, so the
 * lines read as deliberate art direction rather than photographic noise),
 * the real photograph resolves in underneath in a cool duotone "technical"
 * grade with a slow camera push, and that grade then resolves to full
 * colour as the linework flashes once and dissolves — the building has
 * been constructed in front of the viewer, not just faded into view. The
 * title's characters land last, rippling in from the right, where the
 * roofline's own sweep terminates — typography emerging from the
 * architecture, not pasted in front of it.
 *
 * Title reveal is a hand-rolled overflow-mask/translateY animation rather
 * than the SplitText plugin — one fewer moving part (no plugin/font-load
 * race) for the single most important element on the page. A hard timeout
 * safety-net further guarantees every element ends up fully visible even if
 * a GSAP step is ever interrupted, so the CTAs can never get stuck hidden.
 */
export function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const pushRef = useRef<HTMLDivElement>(null);
  const backgroundLayerRef = useRef<HTMLDivElement>(null);
  const foregroundLayerRef = useRef<HTMLDivElement>(null);
  const blueprintRef = useRef<HTMLDivElement>(null);
  const coreLightRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const titleWords = heroContent.title.split(" ");
  const [mainImageLoaded, setMainImageLoaded] = useState(false);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function forceVisible() {
        gsap.set(ALL_HERO_SELECTORS, { clearProps: "all" });
        gsap.set(pushRef.current, { scale: 1 });
        gsap.set([backgroundLayerRef.current, foregroundLayerRef.current], {
          opacity: 1,
          filter: REALITY_FILTER,
          x: 0,
          y: 0,
        });
        gsap.set(blueprintRef.current, { opacity: 0 });
        gsap.set(coreLightRef.current, { opacity: 0 });
      }

      if (reduced) {
        forceVisible();
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      const primaryLine = "[data-blueprint-primary]";
      const columnLines = "[data-blueprint-column]";
      const secondaryLines = "[data-blueprint-secondary]";
      const tickMark = "[data-blueprint-tick]";

      tl.set(pushRef.current, { scale: 1.22 })
        .set([backgroundLayerRef.current, foregroundLayerRef.current], {
          opacity: 0,
          filter: DUOTONE_FILTER,
          x: 0,
          y: 0,
        })
        .set(blueprintRef.current, { opacity: 0 })
        .set(coreLightRef.current, { opacity: 0, scale: 0.5 })
        .set([primaryLine, columnLines, secondaryLines], { drawSVG: "0%" })
        .set(tickMark, { opacity: 0 })
        .set("[data-hero-char]", { opacity: 0, yPercent: 115, filter: "blur(7px)" })
        .set("[data-hero-location]", { opacity: 0, y: 12 })
        .set("[data-hero-cta]", { opacity: 0, y: 12 })
        .set("[data-hero-brandmark]", { opacity: 0, y: 10 })

        // PHASE 1 — Void: the ident's point of light holds, then dissolves
        // as the blueprint takes over telling the story.
        .to(coreLightRef.current, { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" }, CURTAIN_START)
        .to(coreLightRef.current, { opacity: 0, duration: 0.4, ease: "power2.in" }, CURTAIN_START + 0.35)

        // PHASE 2 — Blueprint: the building draws itself. The roofline
        // first (the one big gesture), then the column rhythm ticks in,
        // then the quieter supporting lines, then a single restrained
        // dimension mark.
        .to(blueprintRef.current, { opacity: 1, duration: 0.2 }, CURTAIN_START + 0.15)
        .to(primaryLine, { drawSVG: "100%", duration: 0.6, ease: "power2.inOut" }, CURTAIN_START + 0.2)
        .to(columnLines, { drawSVG: "100%", duration: 0.35, stagger: { each: 0.045, from: "start" }, ease: "power1.inOut" }, CURTAIN_START + 0.55)
        .to(secondaryLines, { drawSVG: "100%", duration: 0.5, stagger: 0.08, ease: "power2.inOut" }, CURTAIN_START + 0.75)
        .to(tickMark, { opacity: 0.7, duration: 0.25 }, CURTAIN_START + 1.05)

        // PHASE 3 — Digital reconstruction: the real photo fades in under
        // the linework in a cool, technical duotone, and the camera begins
        // its push — foreground (closer to the viewer) drifting slightly
        // more than background, a depth cue without needing a depth map.
        .to(
          [backgroundLayerRef.current, foregroundLayerRef.current],
          { opacity: 1, duration: 0.7, ease: "power2.out" },
          CURTAIN_START + 0.95,
        )
        .to(pushRef.current, { scale: 1, duration: CURTAIN_DURATION - 0.9, ease: "cameraPush" }, CURTAIN_START + 0.95)
        .to(backgroundLayerRef.current, { y: -1.2, duration: CURTAIN_DURATION - 0.9, ease: "cameraPush" }, CURTAIN_START + 0.95)
        .to(foregroundLayerRef.current, { y: -2.6, duration: CURTAIN_DURATION - 0.9, ease: "cameraPush" }, CURTAIN_START + 0.95)

        // PHASE 4 — Blueprint → Reality: the duotone grade resolves to
        // true colour, and the linework flashes once and dissolves —
        // the building has been constructed in front of the viewer.
        .to(
          [backgroundLayerRef.current, foregroundLayerRef.current],
          { filter: REALITY_FILTER, duration: 0.75, ease: "power2.inOut" },
          REVEAL_AT - 0.55,
        )
        .to([primaryLine, columnLines, secondaryLines, tickMark], { opacity: 1, duration: 0.12, ease: "power1.out" }, REVEAL_AT - 0.5)
        .to(blueprintRef.current, { opacity: 0, duration: 0.5, ease: "power2.in" }, REVEAL_AT - 0.35)

        // PHASE 5 — Event reveal: everything lands together, characters
        // rippling in from the right — where the roofline's own sweep
        // terminated — not a generic centre-out fade.
        .to("[data-hero-brandmark]", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, REVEAL_AT)
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
        .to("[data-hero-location]", { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, REVEAL_AT + 0.15)
        .to("[data-hero-cta]", { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }, REVEAL_AT + 0.3);

      // Safety net: a plain setTimeout (not GSAP's own rAF-driven clock) so
      // visibility is guaranteed on real wall-clock time even if the ticker
      // itself is throttled (backgrounded tab, low-power mode, etc.) —
      // nothing on this page may depend on GSAP finishing to become visible.
      const safetyTimer = window.setTimeout(forceVisible, (REVEAL_AT + 2.5) * 1000);

      // Continuous cursor-reactive depth (prompt.md §8 "hover depth /
      // cursor-based movement") — two layers at different speeds so the
      // scene reads as having real depth: the particle field, being
      // "closer" to the viewer, drifts further than the background photo.
      const quickMain = {
        x: gsap.quickTo(imageRef.current, "x", { duration: 0.8, ease: "power3.out" }),
        y: gsap.quickTo(imageRef.current, "y", { duration: 0.8, ease: "power3.out" }),
      };
      const quickParticles = {
        x: gsap.quickTo(particlesRef.current, "x", { duration: 0.6, ease: "power3.out" }),
        y: gsap.quickTo(particlesRef.current, "y", { duration: 0.6, ease: "power3.out" }),
      };

      function handlePointerMove(e: PointerEvent) {
        const rect = rootRef.current?.getBoundingClientRect();
        if (!rect) return;
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        quickMain.x(relX * 16);
        quickMain.y(relY * 16);
        quickParticles.x(relX * 34);
        quickParticles.y(relY * 34);
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
      <div ref={particlesRef} className="absolute inset-0">
        <ParticleField />
      </div>

      {/* Campus imagery: IDEA -> ENGINEERING -> TECHNOLOGY -> REALITY. The
          building draws in as architectural line art, the real photo
          resolves underneath in a cool technical grade with a camera push,
          then the grade resolves to true colour as the linework dissolves. */}
      <div
        ref={imageRef}
        data-hero-image
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--color-surface-2),_var(--color-void))]"
        style={{ clipPath: "inset(0% round 24px)" }}
      >
        <div ref={pushRef} className="absolute inset-0">
          <div ref={backgroundLayerRef} className="absolute inset-0">
            <Image
              src={heroContent.campusImage.src}
              alt={heroContent.campusImage.alt}
              fill
              priority
              fetchPriority="high"
              sizes="100vw"
              onLoad={() => setMainImageLoaded(true)}
              className={`object-cover transition-opacity duration-700 ease-out ${mainImageLoaded ? "opacity-95" : "opacity-0"}`}
            />
          </div>
          {/* Same source, masked to just the foreground band (portico +
              nearer trees) and pushed at a slightly faster rate — a
              depth cue without needing an actual segmentation asset. */}
          <div
            ref={foregroundLayerRef}
            className="absolute inset-0"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, transparent 52%, black 62%, black 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, transparent 52%, black 62%, black 100%)",
            }}
          >
            <Image
              src={heroContent.campusImage.src}
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
          {/* Film grain disguises the source photo's compression as an
              intentional cinematic grade instead of a stretched, soft image. */}
          <GrainOverlay opacity={0.06} />
        </div>

        <div ref={blueprintRef} className="absolute inset-0 opacity-0">
          <BuildingBlueprint />
        </div>

        {/* Vignette + wash for text legibility, not a near-opaque curtain over the photo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_var(--color-void)_92%)] opacity-70" />
        <div className="absolute inset-0 bg-void/30" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />

        {/* The handoff point of light from the ident — blooms once, then
            dissolves as the blueprint takes over telling the story. */}
        <div
          ref={coreLightRef}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-20 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
          style={{ background: "radial-gradient(circle, var(--color-ink) 0%, transparent 72%)", filter: "blur(6px)" }}
        />
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center px-2 text-center">
        <p
          data-hero-brandmark
          className="mb-3 w-full max-w-2xl px-2 font-heading text-xs tracking-[0.2em] text-ink uppercase sm:tracking-[0.35em] sm:text-sm"
        >
          {heroContent.eyebrow}
        </p>

        <h1 className="w-full text-center font-display text-[clamp(2.75rem,13vw,11rem)] leading-[0.9] tracking-wide text-ink">
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

        <p data-hero-location className="mt-6 w-full font-heading text-base tracking-[0.2em] text-ink uppercase sm:tracking-[0.3em] sm:text-lg">
          GITAM Visakhapatnam
        </p>

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
          <div data-hero-cta>
            <MagneticButton href="/register" variant="primary">
              {heroContent.registerCtaLabel}
            </MagneticButton>
          </div>
          <div data-hero-cta>
            <MagneticButton href="/login" variant="secondary" cursorKind="interactive">
              {heroContent.loginCtaLabel}
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  );
}
