"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ParticleField } from "@/components/motion/ParticleField";
import { GrainOverlay } from "@/components/motion/GrainOverlay";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { BuildingBlueprint } from "@/components/motion/BuildingBlueprint";
import { BuildingPhotograph } from "@/components/motion/BuildingPhotograph";
import { heroContent } from "@/data/site-config";
import { CURTAIN_START, CURTAIN_DURATION, REVEAL_AT } from "@/lib/hero-timing";

const ALL_HERO_SELECTORS = "[data-hero-brandmark], [data-hero-char], [data-hero-location], [data-hero-cta]";

/**
 * Act 1 — Arrival. The building constructs itself from its own architectural
 * blueprint, in a fixed, unmoving composition: DARK → BLUEPRINT → BLUEPRINT
 * GAINS DIMENSION → BUILDING MATERIALIZES REGION BY REGION → BLUEPRINT
 * DISSOLVES → real photograph → title.
 *
 * Deliberately NOT a camera move of any kind during construction — no
 * scale, no pan, no dolly. The photograph (via BuildingPhotograph.tsx) and
 * the blueprint (via BuildingBlueprint.tsx) both sit in one fixed
 * `viewBox="0 0 100 75"` frame and never transform there; only opacity,
 * stroke-drawing, and per-panel clip-rect heights animate. The building
 * never moves during its own construction — only its visual state does.
 * Once fully materialized, a small (±16px) cursor-reactive hover parallax
 * on the settled photograph resumes — see `quickImage` below — the idle
 * "hover depth" interactivity the rest of the site uses, not a construction
 * camera move.
 *
 * The materialization itself is the core effect: BuildingPhotograph clips
 * the same photo through the building's own measured architectural panels
 * (return facade, the bay past the corner, the connector wall, each
 * pilaster bay, the ground/fence strip) — shared geometry with the
 * blueprint via `@/lib/building-geometry` — and each panel's clip rect
 * grows from zero height independently, staggered left to right with the
 * ground/foreground strip held back until last. At the sequence's
 * midpoint several regions are mid-reveal simultaneously: some still bare
 * blueprint, some fully photographic, one or two mid-grow between the two
 * — there is no single wipe line or reveal shape, the building's own
 * geometry is the mask.
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
  const blueprintRef = useRef<HTMLDivElement>(null);
  const coreLightRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const foregroundLayerRef = useRef<HTMLDivElement>(null);
  const titleWords = heroContent.title.split(" ");

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function forceVisible() {
        gsap.set(ALL_HERO_SELECTORS, { clearProps: "all" });
        gsap.set(foregroundLayerRef.current, { opacity: 0.4 });
        gsap.set("[data-reveal-base]", { opacity: 1 });
        gsap.set("[data-reveal-clip]", { attr: { height: (_i: number, target: SVGRectElement) => target.dataset.fullHeight ?? "0" } });
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
      const mullionLines = "[data-blueprint-mullion] path";
      const secondaryLines = "[data-blueprint-secondary]";
      const volumeLines = "[data-blueprint-volume]";
      const surfaceFills = "[data-blueprint-surface]";
      const tickMark = "[data-blueprint-tick]";
      const revealClips = "[data-reveal-clip]";
      const revealBase = "[data-reveal-base]";

      tl.set(blueprintRef.current, { opacity: 1 })
        .set(foregroundLayerRef.current, { opacity: 0 })
        .set(coreLightRef.current, { opacity: 0, scale: 0.5 })
        .set(sweepRef.current, { opacity: 0, xPercent: -150 })
        .set(pointNodes, { opacity: 0, scale: 0 })
        .set([primaryLine, columnLines, mullionLines, secondaryLines], { drawSVG: "0%" })
        .set(volumeLines, { opacity: 0, drawSVG: "0%" })
        .set(surfaceFills, { opacity: 0 })
        .set(tickMark, { opacity: 0 })
        .set(revealBase, { opacity: 0 })
        .set(revealClips, { attr: { height: 0 } })
        .set("[data-hero-char]", { opacity: 0, yPercent: 115, filter: "blur(7px)" })
        .set("[data-hero-location]", { opacity: 0, y: 12 })
        .set("[data-hero-cta]", { opacity: 0, y: 12 })
        .set("[data-hero-brandmark]", { opacity: 0, y: 10 })

        // STATE 1 — DARK (~0–0.4s): the ident's point of light holds
        // briefly against pure darkness, then hands off as the first
        // survey points begin to appear. Short: the wait shouldn't
        // outstay its welcome.
        .to(coreLightRef.current, { opacity: 1, scale: 1, duration: 0.22, ease: "power2.out" }, CURTAIN_START)
        .to(coreLightRef.current, { opacity: 0, duration: 0.3, ease: "power2.in" }, CURTAIN_START + 0.28)

        // STATE 2 — BLUEPRINT DRAWS (~0.4–1.55s): points establish the
        // form, then connect into the roofline (the one big gesture), the
        // column rhythm, the quieter window-edge mullions, and the
        // full-width floor-divider lines. Points dissolve as the lines
        // that connect them take over. By the end of this block the
        // building is fully recognisable from linework alone, on pure
        // darkness — no photograph anywhere yet.
        .to(pointNodes, { opacity: 1, scale: 1, duration: 0.3, stagger: { each: 0.02, from: "random" }, ease: "back.out(2)" }, CURTAIN_START + 0.4)
        .to(pointNodes, { opacity: 0, duration: 0.25, ease: "power1.in" }, CURTAIN_START + 0.78)
        .to(primaryLine, { drawSVG: "100%", duration: 0.55, ease: "power2.inOut" }, CURTAIN_START + 0.55)
        .to(columnLines, { drawSVG: "100%", duration: 0.32, stagger: { each: 0.04, from: "start" }, ease: "power1.inOut" }, CURTAIN_START + 0.85)
        .to(mullionLines, { drawSVG: "100%", duration: 0.35, stagger: { each: 0.018, from: "start" }, ease: "power1.inOut" }, CURTAIN_START + 1.05)
        .to(secondaryLines, { drawSVG: "100%", duration: 0.3, stagger: 0.035, ease: "power2.inOut" }, CURTAIN_START + 1.3)
        .to(tickMark, { opacity: 0.7, duration: 0.2 }, CURTAIN_START + 1.5)

        // STATE 3 — BLUEPRINT GAINS DIMENSION (~1.4–1.6s): a quick flash
        // of perspective construction lines toward the vanishing point,
        // and the flat-shaded surface panels gain "material" — the
        // building reads as having depth and mass just before it starts
        // becoming physically real.
        .to(volumeLines, { opacity: 1, drawSVG: "100%", duration: 0.28, ease: "power2.out" }, CURTAIN_START + 1.4)
        .to(volumeLines, { opacity: 0, duration: 0.28, ease: "power1.in" }, CURTAIN_START + 1.72)
        .to(surfaceFills, { opacity: 1, duration: 0.3, ease: "power2.out" }, CURTAIN_START + 1.5)

        // STATE 4/5 — MATERIALIZATION (~1.55–2.9s): the real photograph
        // is revealed strictly through the building's own architectural
        // regions — see BuildingPhotograph.tsx / `@/lib/building-geometry`
        // — each panel's clip rect growing from zero height independently,
        // left to right across the facade with the ground/foreground strip
        // (fence, pipes, car) held back until last since it isn't the
        // subject. No camera motion, no whole-image crossfade: the
        // building's own geometry is the reveal shape, and different
        // regions are visibly in different states at once.
        .to(
          revealClips,
          {
            attr: { height: (_i: number, target: SVGRectElement) => target.dataset.fullHeight ?? "0" },
            duration: 0.45,
            stagger: { each: 0.11, from: "start" },
            ease: "power2.inOut",
          },
          CURTAIN_START + 1.55,
        )
        .to(revealBase, { opacity: 1, duration: 1.3, ease: "power2.inOut" }, CURTAIN_START + 1.6)
        .to(foregroundLayerRef.current, { opacity: 0.4, duration: 0.5, ease: "power2.out" }, CURTAIN_START + 2.5)

        // STATE 6 — BLUEPRINT DISSOLVES (~2.9–3.3s): every line and
        // surface fill fades away together now that the real photograph
        // fully occupies the frame beneath them, leaving the finished
        // building on its own.
        .to([primaryLine, columnLines, mullionLines, secondaryLines, tickMark, surfaceFills], { opacity: 0, duration: 0.4, ease: "power2.in" }, REVEAL_AT - 0.5)
        .to(blueprintRef.current, { opacity: 0, duration: 0.1 }, REVEAL_AT - 0.12)

        // STATE 7 — EVENT REVEAL: one restrained light sweep crosses the
        // facade as the construction settles, and everything lands
        // together: characters snapping out of their own blur into
        // focus, rippling in from the right where the roofline's own
        // sweep terminated. The masked foreground layer (already stacked
        // above the title in the DOM) is what gives the type its depth
        // plane — no separate animation needed, it's just already there.
        .to(sweepRef.current, { opacity: 0.4, duration: 0.05 }, REVEAL_AT - 0.3)
        .to(sweepRef.current, { xPercent: 150, opacity: 0, duration: 0.55, ease: "power1.inOut" }, REVEAL_AT - 0.25)
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
      // cursor-based movement") once the sequence has settled — a small,
      // direct translate (no scale, no perspective change) with the
      // particle field, being "closer" to the viewer, drifting a bit
      // further than the building photograph. This is a gentle idle-state
      // hover effect, not a camera move of the opening sequence itself.
      //
      // The photograph is two separate DOM layers — imageRef (the main
      // photo + blueprint, z-behind the title) and foregroundLayerRef (a
      // masked duplicate of the same photo's bottom band, z-above the
      // title, for the architecture/title depth-overlap) — so both must be
      // driven by the *same* relX/relY each pointermove. Moving only one
      // visibly shears the two copies of the photo apart at the boundary
      // between them, reading as a blur/warp rather than a clean shift.
      //
      // quickTo's own internal easing (not a raw set) is what makes it
      // track the cursor smoothly rather than snapping to each
      // pointermove sample — keep it identical across both layers
      // (duration/ease) so they stay in lockstep rather than drifting
      // apart frame to frame.
      const quickImage = {
        x: gsap.quickTo(imageRef.current, "x", { duration: 0.8, ease: "power3.out" }),
        y: gsap.quickTo(imageRef.current, "y", { duration: 0.8, ease: "power3.out" }),
      };
      const quickForeground = {
        x: gsap.quickTo(foregroundLayerRef.current, "x", { duration: 0.8, ease: "power3.out" }),
        y: gsap.quickTo(foregroundLayerRef.current, "y", { duration: 0.8, ease: "power3.out" }),
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
        quickImage.x(relX * 8);
        quickImage.y(relY * 8);
        quickForeground.x(relX * 8);
        quickForeground.y(relY * 8);
        quickParticles.x(relX * 18);
        quickParticles.y(relY * 18);
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

      {/* Campus imagery: a single fixed composition, never scaled or
          panned. Points -> lines -> volume -> surfaces -> the real photo
          resolving strictly through the building's own architectural
          regions (BuildingPhotograph.tsx), region by region across the
          facade — never a single visible reveal shape, never a camera move. */}
      <div
        ref={imageRef}
        data-hero-image
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--color-surface-2),_var(--color-void))] will-change-transform"
        style={{ clipPath: "inset(0% round 24px)" }}
      >
        <BuildingPhotograph src={heroContent.campusImage.src} />

        {/* Film grain disguises the source photo's compression as an
            intentional cinematic grade instead of a stretched, soft image. */}
        <GrainOverlay opacity={0.06} />

        {/* The blueprint's linework sits directly on the photo, no masking
            shape between them — the lines draw themselves over pure
            darkness, the real photo materializes region by region
            underneath, and the lines dissolve once it has fully resolved. */}
        <div ref={blueprintRef} className="absolute inset-0">
          <BuildingBlueprint />
        </div>

        {/* Signature moment — one restrained light sweep across the facade
            as the construction settles. Neutral, not gold. */}
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
            reveal is driven by BuildingPhotograph's SVG layers above,
            which share the browser's cached copy of the same URL. */}
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

      {/* Same source as the main photograph, masked to just the foreground
          band (building corner + nearer trees) — deliberately stacked
          ABOVE the title text (not inside the -z-10 image block) so the
          architecture genuinely overlaps the typography where they'd
          intersect at this depth, rather than the title sitting flatly on
          top of everything. Never scaled during construction — only
          opacity there — but it does share the same small hover-parallax
          translate as the main image once settled (see quickForeground in
          the pointermove handler above), since it's a duplicate of the
          same photo and would visibly shear apart from the main layer
          otherwise. */}
      <div
        ref={foregroundLayerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-0 will-change-transform"
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
