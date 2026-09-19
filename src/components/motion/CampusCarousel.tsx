"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { CampusSlide } from "@/types/config";

const SLIDE_MS = 6500;
const FADE_MS = 1800;

/**
 * The hero's campus imagery: an ambient crossfade through every campus
 * running Phase 1 (SPEC.md §2), each with a slow Ken-Burns drift and its own
 * giant, faded watermark of the campus name spanning the whole frame.
 * Deliberately sized to bleed past the frame's edges on narrow viewports
 * (the parent layer clips it) rather than shrinking small enough to always
 * fit — the point is a wall of soft type behind the real title, not a tidy
 * caption.
 *
 * Plain alpha (not `mix-blend-overlay`, unlike the grain texture) with a
 * soft drop shadow for definition — these photos are mostly bright sky and
 * light building facades, and overlay/soft-light blending a near-white fill
 * against an already-light backdrop washes out to nearly nothing. Plain
 * alpha plus a dark shadow stays visible regardless of how bright or dark
 * the photo underneath is.
 *
 * Hero.tsx controls *when* this becomes visible (fading it in, or showing
 * it immediately under prefers-reduced-motion) — this component only owns
 * which slide is showing, independent of that, so it's already mid-rotation
 * by the time it's revealed.
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

            {/* Giant, faded location watermark spanning the whole background, crossfading in lockstep with its own photo. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              <span
                className="w-full text-center font-display text-[clamp(4.5rem,20vw,19rem)] leading-none whitespace-nowrap tracking-[0.02em] text-ink/[0.28] uppercase"
                style={{ textShadow: "0 8px 48px rgba(0,0,0,0.45)" }}
              >
                {slide.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
