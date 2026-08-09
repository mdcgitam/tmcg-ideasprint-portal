"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { mulberry32 } from "@/lib/seeded-random";

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

const COLORS = ["var(--color-gold)", "var(--color-mdc)", "var(--color-gitam)"];

function generateParticles(count: number, seed: number): Particle[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 2 + rand() * 3,
    color: COLORS[i % COLORS.length],
    delay: rand() * 4000,
  }));
}

const particles = generateParticles(20, 42);

/**
 * Ambient constellation of drifting/twinkling points behind the hero.
 * anime.js orchestrates per-dot opacity + transform pulses (prompt.md §3).
 */
export function ParticleField() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dots = containerRef.current?.querySelectorAll<HTMLElement>("[data-particle]");
    if (!dots || dots.length === 0) return;

    const animation = animate(dots, {
      opacity: [
        { to: 0.15, duration: 0 },
        { to: 0.65, duration: 2200 },
        { to: 0.15, duration: 2200 },
      ],
      translateY: [
        { to: 0, duration: 0 },
        { to: -18, duration: 4400, ease: "inOutSine" },
      ],
      loop: true,
      delay: stagger(140, { start: 0 }),
    });

    return () => {
      animation.pause();
    };
  }, []);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          data-particle
          className="absolute rounded-full opacity-20"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}
