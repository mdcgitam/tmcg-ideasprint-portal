"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { CampusSlide } from "@/types/config";

const SLIDE_MS = 6500;
const FADE_MS = 1800;

/**
 * The hero's "settled" state, once Act 1's building-construction reveal
 * (Hero.tsx) has finished with it: an ambient crossfade through every
 * campus running Phase 1 (SPEC.md §2), each with a slow Ken-Burns drift and
 * its own large, barely-there watermark of the campus name — mirrors the
 * grain overlay's `mix-blend-overlay` treatment so the type reads as
 * pressed into the photograph rather than sitting on top of it.
 *
 * Hero.tsx controls *when* this becomes visible (fading it in as the final
 * beat of the arrival sequence, or immediately under prefers-reduced-motion)
 * — this component only owns which slide is showing, independent of that,
 * so it's already mid-rotation by the time it's revealed.
 */
export function CampusCarousel({ slides }: { slides: CampusSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  return (
    <div className="absolute inset-0">
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.src}
            aria-hidden={!active}
            className="absolute inset-0 overflow-hidden transition-opacity ease-in-out"
            style={{ opacity: active ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
          >
            <div
              className="absolute inset-0 transition-transform ease-linear motion-reduce:transition-none"
              style={{ transform: active ? "scale(1.08)" : "scale(1)", transitionDuration: `${SLIDE_MS + FADE_MS}ms` }}
            >
              <Image src={slide.src} alt={slide.alt} fill sizes="100vw" priority={i === 0} className="object-cover" />
            </div>

            {/* Large, near-invisible location watermark, crossfading in lockstep with its own photo. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
              <span className="select-none text-center font-display text-[clamp(3rem,16vw,13rem)] leading-none tracking-[0.02em] text-ink/[0.09] uppercase mix-blend-overlay">
                {slide.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
