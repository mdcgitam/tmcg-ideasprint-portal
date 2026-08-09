"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { useGSAP } from "@gsap/react";
import { REVEAL_AT } from "@/lib/hero-timing";
import { cn } from "@/lib/utils";

/**
 * Scroll-aware header — transparent over the hero, condenses into a solid
 * bar once the user scrolls past it (prompt.md §4, §37). Only on the
 * homepage does the logo row/links wait for REVEAL_AT, the instant the
 * Hero's curtain finishes opening — on every other page there's no curtain
 * to wait for, so the header just shows immediately.
 */
export function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const isHome = usePathname() === "/";

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 64);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useGSAP(
    () => {
      if (!isHome || prefersReducedMotion()) return;
      gsap.set("[data-nav-reveal]", { opacity: 0, y: -8 });
      gsap.to("[data-nav-reveal]", {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: "power2.out",
        delay: REVEAL_AT,
      });
    },
    { scope: navRef },
  );

  return (
    <header
      ref={navRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "border-b border-border bg-void/85 backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Primary" className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
        <Link
          href="/"
          data-cursor="interactive"
          data-nav-reveal
          className="flex shrink-0 items-center gap-1.5 sm:gap-3.5"
        >
          <Image
            src="/assets/brand/gitam-logo.jpeg"
            alt="GITAM"
            width={1212}
            height={532}
            style={{ filter: "url(#logo-key-black)" }}
            className="h-6 w-auto sm:h-10"
          />
          <span className="font-display text-sm text-ink-faint sm:text-lg">×</span>
          <Image
            src="/assets/brand/tmcg-logo.jpeg"
            alt="TMCG"
            width={601}
            height={216}
            style={{ filter: "url(#logo-key-black)" }}
            className="h-6 w-auto sm:h-10"
          />
          <span className="font-display text-sm text-ink-faint sm:text-lg">×</span>
          <Image
            src="/assets/brand/mdc-logo.png"
            alt="MDC"
            width={512}
            height={257}
            className="h-6 w-auto sm:h-10"
          />
        </Link>

        <div data-nav-reveal className="flex shrink-0 items-center gap-6">
          <Link
            href="/login"
            data-cursor="interactive"
            className="hidden font-heading text-sm text-ink-muted transition-colors hover:text-ink sm:block"
          >
            Login
          </Link>
          <Link
            href="/register"
            data-cursor="cta"
            className="rounded-full bg-gold px-5 py-2.5 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light"
          >
            Register
          </Link>
        </div>
      </nav>
    </header>
  );
}
