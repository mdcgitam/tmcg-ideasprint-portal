"use client";

import { useRef } from "react";
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

// Softer than a first pass — enough to read as "digital/technical" without
// crushing the building's actual colour and detail away.
const DUOTONE_FILTER = "grayscale(0.5) sepia(0.12) hue-rotate(150deg) saturate(1.5) brightness(0.92) contrast(1.1)";
const REALITY_FILTER = "grayscale(0) sepia(0) hue-rotate(0deg) saturate(1.12) brightness(1) contrast(1.08)";

/**
 * Act 1 — Arrival (prompt.md §43). One continuous construction, not a
 * blueprint layer crossfading into a photograph: vertices appear first
 * (survey points establishing the form), connect into the roofline and
 * column rhythm, a set of perspective construction lines flashes through
 * to establish depth, and flat-shaded surfaces fill in behind the linework.
 * The real photograph then resolves through those exact same surface
 * shapes — the panels in BuildingBlueprint.tsx, the return facade, the
 * connector wall, each pilaster bay individually, the ground plane — each one a
 * separately clip-path'd, separately opacity-animated slice of the same
 * photo, staggered left to right across the facade. There is no single
 * recognisable "reveal shape": the building's own geometry is the mask.
 * A slow camera push (a bespoke `CustomEase` curve, not stock easing)
 * carries the whole sequence forward while the grade lifts from a cool
 * "digital" duotone toward the building's true warm colour, and a single
 * restrained light sweep crosses the facade as the grade finishes
 * resolving — the one signature beat, not a HUD. The title's characters
 * land last, snapping out of their own blur into focus, rippling in from
 * the right where the roofline's own sweep terminates — and the same
 * masked foreground layer that gives the photo its parallax also sits
 * above the title, so the architecture genuinely overlaps the type at the
 * depth plane where they'd really intersect, rather than the title just
 * being pasted on top.
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
  const sweepRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const titleWords = heroContent.title.split(" ");

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function forceVisible() {
        gsap.set(ALL_HERO_SELECTORS, { clearProps: "all" });
        gsap.set(pushRef.current, { scale: 1 });
        gsap.set(foregroundLayerRef.current, { scale: 1, x: 0, y: 0, opacity: 0.4, filter: REALITY_FILTER });
        gsap.set(backgroundLayerRef.current, { filter: REALITY_FILTER, x: 0, y: 0, opacity: 1 });
        gsap.set(blueprintRef.current, { opacity: 0 });
        gsap.set(coreLightRef.current, { opacity: 0 });
        gsap.set(sweepRef.current, { opacity: 0 });
      }

      if (reduced) {
        forceVisible();
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      const pointNodes = "[data-blueprint-point]";
      const primaryLine = "[data-blueprint-primary]";
      const columnLines = "[data-blueprint-column]";
      const secondaryLines = "[data-blueprint-secondary]";
      const volumeLines = "[data-blueprint-volume]";
      const surfaceFills = "[data-blueprint-surface]";
      const tickMark = "[data-blueprint-tick]";

      tl.set(pushRef.current, { scale: 1.22 })
        .set(foregroundLayerRef.current, { scale: 1.34, x: 0, y: 0, opacity: 0 })
        .set(backgroundLayerRef.current, { filter: DUOTONE_FILTER, x: 0, opacity: 0 })
        .set(blueprintRef.current, { opacity: 1 })
        .set(coreLightRef.current, { opacity: 0, scale: 0.5 })
        .set(sweepRef.current, { opacity: 0, xPercent: -150 })
        .set(pointNodes, { opacity: 0, scale: 0 })
        .set([primaryLine, columnLines, secondaryLines], { drawSVG: "0%" })
        .set(volumeLines, { opacity: 0, drawSVG: "0%" })
        .set(surfaceFills, { opacity: 0 })
        .set(tickMark, { opacity: 0 })
        .set("[data-hero-char]", { opacity: 0, yPercent: 115, filter: "blur(7px)" })
        .set("[data-hero-location]", { opacity: 0, y: 12 })
        .set("[data-hero-cta]", { opacity: 0, y: 12 })
        .set("[data-hero-brandmark]", { opacity: 0, y: 10 })

        // ANTICIPATION (~0–0.6s) — the ident's point of light holds
        // briefly, then hands off as the vertices begin to appear. Short:
        // the wait shouldn't outstay its welcome.
        .to(coreLightRef.current, { opacity: 1, scale: 1, duration: 0.22, ease: "power2.out" }, CURTAIN_START)
        .to(coreLightRef.current, { opacity: 0, duration: 0.3, ease: "power2.in" }, CURTAIN_START + 0.28)

        // ARCHITECTURE EMERGES (~0.4–1.5s) — points establish the form,
        // then connect into the roofline (the one big gesture), the
        // column rhythm, and the quieter supporting lines. Points dissolve
        // as the lines that connect them take over.
        .to(pointNodes, { opacity: 1, scale: 1, duration: 0.3, stagger: { each: 0.02, from: "random" }, ease: "back.out(2)" }, CURTAIN_START + 0.4)
        .to(pointNodes, { opacity: 0, duration: 0.25, ease: "power1.in" }, CURTAIN_START + 0.78)
        .to(primaryLine, { drawSVG: "100%", duration: 0.55, ease: "power2.inOut" }, CURTAIN_START + 0.55)
        .to(columnLines, { drawSVG: "100%", duration: 0.32, stagger: { each: 0.04, from: "start" }, ease: "power1.inOut" }, CURTAIN_START + 0.85)
        .to(secondaryLines, { drawSVG: "100%", duration: 0.4, stagger: 0.06, ease: "power2.inOut" }, CURTAIN_START + 1.05)
        .to(tickMark, { opacity: 0.7, duration: 0.2 }, CURTAIN_START + 1.3)

        // BUILDING RECONSTRUCTION (~1.4–3.2s) — perspective construction
        // lines flash through to establish depth, flat-shaded surfaces
        // gain "material", and the real photograph fades in beneath the
        // linework as one whole image — no panels, no clip-path blocks,
        // just the photo materialising directly under the lines that are
        // already tracing it — while the camera push carries the whole
        // frame forward and the grade begins lifting out of duotone.
        .to(volumeLines, { opacity: 1, drawSVG: "100%", duration: 0.3, ease: "power2.out" }, CURTAIN_START + 1.4)
        .to(volumeLines, { opacity: 0, duration: 0.3, ease: "power1.in" }, CURTAIN_START + 1.85)
        .to(surfaceFills, { opacity: 1, duration: 0.35, ease: "power2.out" }, CURTAIN_START + 1.55)
        .to(backgroundLayerRef.current, { opacity: 1, duration: 0.7, ease: "power2.inOut" }, CURTAIN_START + 1.85)
        .to(foregroundLayerRef.current, { opacity: 0.4, duration: 0.5, ease: "power2.out" }, CURTAIN_START + 2.6)
        .to(pushRef.current, { scale: 1, duration: CURTAIN_DURATION - 1.5, ease: "cameraPush" }, CURTAIN_START + 1.85)
        .to(foregroundLayerRef.current, { scale: 1, duration: CURTAIN_DURATION - 1.5, ease: "cameraPush" }, CURTAIN_START + 1.85)
        .to(backgroundLayerRef.current, { y: -1.1, duration: CURTAIN_DURATION - 1.5, ease: "cameraPush" }, CURTAIN_START + 1.85)
        .to(foregroundLayerRef.current, { y: -2.4, duration: CURTAIN_DURATION - 1.5, ease: "cameraPush" }, CURTAIN_START + 1.85)
        .to([primaryLine, columnLines, secondaryLines, tickMark, surfaceFills], { opacity: 0, duration: 0.5, ease: "power2.in" }, REVEAL_AT - 0.9)
        .to(blueprintRef.current, { opacity: 0, duration: 0.1 }, REVEAL_AT - 0.35)

        // EVENT REVEAL — the grade finishes lifting to true colour, one
        // restrained light sweep crosses the facade as it settles, and
        // everything lands together: characters snapping out of their own
        // blur into focus, rippling in from the right where the roofline
        // terminated. The masked foreground layer (already stacked above
        // the title in the DOM) is what gives the type its depth plane —
        // no separate animation needed, it's just already there.
        .to(
          [backgroundLayerRef.current, foregroundLayerRef.current],
          { filter: REALITY_FILTER, duration: 0.9, ease: "power2.inOut" },
          REVEAL_AT - 1.1,
        )
        .to(sweepRef.current, { opacity: 0.4, duration: 0.05 }, REVEAL_AT - 0.4)
        .to(sweepRef.current, { xPercent: 150, opacity: 0, duration: 0.55, ease: "power1.inOut" }, REVEAL_AT - 0.35)
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
      // This is the only motion left once the sequence settles — everything
      // else is a one-shot entrance, nothing loops or keeps animating on
      // its own.
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

      {/* Campus imagery: points -> lines -> volume -> surfaces -> the real
          photo resolving through those exact same surface shapes, panel by
          panel across the facade — never a single visible reveal shape.
          The foreground layer (building corner + nearer trees) is a separate
          sibling below, stacked ABOVE the title text — the depth plane
          where architecture and typography genuinely overlap. */}
      <div
        ref={imageRef}
        data-hero-image
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--color-surface-2),_var(--color-void))]"
        style={{ clipPath: "inset(0% round 24px)" }}
      >
        <div ref={pushRef} className="absolute inset-0">
          <div
            ref={backgroundLayerRef}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroContent.campusImage.src})` }}
          />
          {/* Film grain disguises the source photo's compression as an
              intentional cinematic grade instead of a stretched, soft image. */}
          <GrainOverlay opacity={0.06} />
        </div>

        {/* The blueprint's linework sits directly on the photo, no masking
            shape between them — the lines draw themselves, then the photo
            underneath fades in as one whole image (not panels/blocks), and
            the lines dissolve once the grade resolves to true colour. */}
        <div ref={blueprintRef} className="absolute inset-0">
          <BuildingBlueprint />
        </div>

        {/* Signature moment — one restrained light sweep across the facade
            as the grade finishes resolving. Neutral, not gold. */}
        <div
          ref={sweepRef}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 z-10 w-1/3 opacity-0 mix-blend-overlay"
          style={{
            backgroundImage:
              "linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.5) 55%, transparent 80%)",
          }}
        />

        {/* Vignette + wash for text legibility, not a near-opaque curtain over the photo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_var(--color-void)_92%)] opacity-70" />
        <div className="absolute inset-0 bg-void/30" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />

        {/* The handoff point of light from the ident — blooms once, then
            dissolves as the construction takes over telling the story. */}
        <div
          ref={coreLightRef}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-20 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
          style={{ background: "radial-gradient(circle, var(--color-ink) 0%, transparent 72%)", filter: "blur(6px)" }}
        />

        {/* Hidden, priority-loaded Image purely so Next.js issues an early
            fetch/preload hint for the campus photo — the actual visible
            reveal is driven by the plain `background-image` panel divs
            above, which share the browser's cached copy of the same URL. */}
        <Image
          src={heroContent.campusImage.src}
          alt=""
          aria-hidden
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="hidden"
        />
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-center px-2 text-center">
        <p
          data-hero-brandmark
          className="mb-3 w-full max-w-2xl px-2 font-heading text-xs tracking-[0.2em] text-ink uppercase sm:tracking-[0.35em] sm:text-sm"
        >
          {heroContent.eyebrow}
        </p>

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

      {/* Same source as the background layer, masked to just the
          foreground band (building corner + nearer trees) — deliberately stacked
          ABOVE the title text (not inside the -z-10 image block) so the
          architecture genuinely overlaps the typography where they'd
          intersect at this depth, rather than the title sitting flatly on
          top of everything. */}
      <div
        ref={foregroundLayerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-0"
        style={{
          clipPath: "inset(0% round 24px)",
          // Starts well below where the eyebrow/title/location text sits —
          // this is a soft atmospheric depth cue in the empty space around
          // the CTAs, not something laid over readable text.
          maskImage: "linear-gradient(to bottom, transparent 0%, transparent 66%, black 78%, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, transparent 66%, black 78%, black 100%)",
        }}
      >
        <Image src={heroContent.campusImage.src} alt="" fill sizes="100vw" className="object-cover" />
      </div>
    </section>
  );
}
