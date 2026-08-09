"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import type { GalleryImage } from "@/types/config";

const SLIDE_DURATION_MS = 2600;

interface GalleryCarouselProps {
  images: GalleryImage[];
}

/**
 * One photo at a time, smooth crossfade + slow Ken Burns drift, auto-advance
 * every ~2.6s, pausable on hover/focus and via an explicit control (WCAG
 * 2.2.2 — auto-advancing content must be pausable). Previous-year gallery
 * (prompt.md §13): an immersive moment, not a plain grid.
 *
 * The transition is driven purely by `index === i` (a plain CSS clip-path
 * transition — a horizontal curtain wipe, echoing the Hero's own curtain
 * reveal) rather than imperative GSAP tweens on tracked refs — with N
 * stacked slides, per-pair ref/z-index bookkeeping is easy to get subtly out
 * of sync (a stale z-index or a missed reset leaves everything invisible).
 * A pure function of state can't get stuck.
 */
export function GalleryCarousel({ images }: GalleryCarouselProps) {
  const [index, setIndex] = useState(0);
  // `playing` is the user's explicit intent (the pause/play button);
  // `hovering` is a transient overlay that suspends auto-advance without
  // altering that intent, so moving the mouse away resumes only if the user
  // hadn't explicitly paused.
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(false);
  const activeImageRef = useRef<HTMLDivElement>(null);

  // Deferred to an effect (not read directly during render) — window isn't
  // available during SSR, and defaulting to `false` there while the real
  // client value could be `true` would be a hydration mismatch.
  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  function goTo(next: number) {
    setIndex((next + images.length) % images.length);
  }

  useEffect(() => {
    if (!playing || hovering || images.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(id);
  }, [playing, hovering, images.length]);

  // Slow Ken Burns drift on whichever slide is currently active.
  useEffect(() => {
    if (prefersReducedMotion() || !activeImageRef.current) return;
    gsap.fromTo(
      activeImageRef.current,
      { scale: 1 },
      { scale: 1.08, duration: SLIDE_DURATION_MS / 1000 + 1, ease: "none", overwrite: true },
    );
  }, [index]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") goTo(index + 1);
    if (e.key === "ArrowLeft") goTo(index - 1);
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Previous year event gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      {images.map((image, i) => {
        const isActive = i === index;
        return (
          <div
            key={image.id}
            className="absolute inset-0"
            style={{
              clipPath: isActive ? "inset(0% 0% 0% 0%)" : "inset(0% 50% 0% 50%)",
              transitionProperty: "clip-path",
              transitionDuration: reduced ? "0ms" : "900ms",
              transitionTimingFunction: "cubic-bezier(0.65, 0, 0.35, 1)",
              zIndex: isActive ? 1 : 0,
            }}
            aria-hidden={!isActive}
          >
            <div ref={isActive ? activeImageRef : undefined} className="absolute inset-0">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 900px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-void/70 via-transparent to-transparent" />

      {/* live region for screen readers */}
      <span className="sr-only" aria-live="polite">
        Slide {index + 1} of {images.length}
      </span>

      <button
        type="button"
        aria-label="Previous photo"
        onClick={() => goTo(index - 1)}
        className="absolute top-1/2 left-3 z-20 -translate-y-1/2 rounded-full border border-ink/20 bg-void/40 p-2 text-ink opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 hover:border-gold hover:text-gold"
      >
        <span aria-hidden>‹</span>
      </button>
      <button
        type="button"
        aria-label="Next photo"
        onClick={() => goTo(index + 1)}
        className="absolute top-1/2 right-3 z-20 -translate-y-1/2 rounded-full border border-ink/20 bg-void/40 p-2 text-ink opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 hover:border-gold hover:text-gold"
      >
        <span aria-hidden>›</span>
      </button>

      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pause slideshow" : "Play slideshow"}
        className="absolute bottom-4 left-4 z-20 flex size-8 items-center justify-center rounded-full border border-ink/20 bg-void/40 text-ink backdrop-blur-sm transition-colors hover:border-gold hover:text-gold"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
            <path d="M7 5v14l12-7z" />
          </svg>
        )}
      </button>

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {images.map((image, i) => (
          <button
            key={image.id}
            type="button"
            aria-label={`Go to photo ${i + 1}`}
            onClick={() => goTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-6 bg-gold" : "w-1.5 bg-ink/30 hover:bg-ink/60",
            )}
          />
        ))}
      </div>

      <div className="absolute right-4 bottom-4 z-20 font-mono text-[10px] text-ink-muted">
        {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
      </div>
    </div>
  );
}
