"use client";

import { useRef } from "react";
import { BrainCircuit, Smartphone, Network, ShieldCheck, type LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { domains } from "@/data/site-config";
import type { DomainIconKey } from "@/types/config";

const ICONS: Record<DomainIconKey, LucideIcon> = {
  "artificial-intelligence": BrainCircuit,
  "app-development": Smartphone,
  "machine-learning": Network,
  cybersecurity: ShieldCheck,
};

const ACCENTS: Record<DomainIconKey, { text: string; border: string; glow: string }> = {
  "artificial-intelligence": { text: "text-gold", border: "hover:border-gold/50", glow: "group-hover:shadow-gold/20" },
  "app-development": { text: "text-mdc", border: "hover:border-mdc/50", glow: "group-hover:shadow-mdc/20" },
  "machine-learning": { text: "text-gitam", border: "hover:border-gitam/50", glow: "group-hover:shadow-gitam/20" },
  cybersecurity: { text: "text-gold", border: "hover:border-gold/50", glow: "group-hover:shadow-gold/20" },
};

/**
 * Act 2 — The Challenge (prompt.md §43). The section pins while the first
 * domain card holds in place and each following card arrives one at a time
 * as the user keeps scrolling, building up to the full single-line row —
 * only then does the page release and continue scrolling.
 */
export function DomainsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current || prefersReducedMotion()) return;

      const cards = gsap.utils.toArray<HTMLElement>("[data-domain-card]", sectionRef.current);
      if (cards.length <= 1) return;

      gsap.set(cards.slice(1), { opacity: 0, y: 50, scale: 0.94 });

      gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          // Short pin distance + light scrub — this should feel like a
          // quick, deliberate reveal, not a long haul of scrolling.
          end: `+=${(cards.length - 1) * 22}%`,
          scrub: 0.2,
          pin: true,
        },
      }).to(cards.slice(1), {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        stagger: 1,
        ease: "power2.out",
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="domains"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden border-t border-border bg-void px-6 sm:px-10 lg:px-16"
    >
      <div className="mb-14 w-full max-w-7xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 2 — The Challenge</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-8xl">DOMAINS</h2>
      </div>

      <div className="grid w-full max-w-7xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
        {domains.map((domain, i) => {
          const Icon = ICONS[domain.iconKey];
          const accent = ACCENTS[domain.iconKey];
          return (
            <div
              key={domain.id}
              data-domain-card
              data-cursor="interactive"
              className={`group flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:gap-4 sm:p-6 ${accent.border} ${accent.glow}`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`size-6 sm:size-8 ${accent.text}`} strokeWidth={1.5} />
                <span className="font-mono text-[10px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="font-heading text-sm leading-tight font-semibold text-ink sm:text-base">{domain.name}</h3>
              <p className="hidden font-heading text-xs text-ink-muted sm:block">{domain.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
