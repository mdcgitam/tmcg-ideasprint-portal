"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  cursorKind?: "cta" | "interactive";
  className?: string;
}

/**
 * CTA button that pulls toward the cursor within its bounds and springs back
 * on leave. `primary` (gold, filled) is visually dominant over `secondary`
 * (glass — translucent void fill + backdrop blur, not just a bare outline,
 * so it stays legible over busy photo backgrounds like the hero) — used to
 * enforce Register > Login hierarchy (prompt.md §7).
 */
export function MagneticButton({
  href,
  children,
  variant = "primary",
  cursorKind = "cta",
  className,
}: MagneticButtonProps) {
  const btnRef = useRef<HTMLAnchorElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = btnRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    gsap.to(el, { x: relX * 0.35, y: relY * 0.5, duration: 0.4, ease: "power3.out" });
  }

  function handleMouseLeave() {
    const el = btnRef.current;
    if (!el) return;
    gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
  }

  return (
    <Link
      ref={btnRef}
      href={href}
      data-cursor={cursorKind}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 font-heading text-sm font-medium tracking-wide uppercase transition-colors duration-300",
        variant === "primary" &&
          "bg-gold text-void shadow-[0_0_40px_-8px_rgba(201,162,39,0.6)] hover:bg-gold-light",
        variant === "secondary" &&
          "border border-ink/20 bg-void/60 text-ink backdrop-blur-md hover:border-gold hover:bg-void/75 hover:text-gold",
        className,
      )}
    >
      {children}
    </Link>
  );
}
