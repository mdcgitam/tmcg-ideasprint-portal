"use client";

import { useRef } from "react";
import { Award, Medal, Trophy, type LucideIcon } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";
import { prizes } from "@/data/site-config";

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN").format(amount);
}

const sorted = [...prizes].sort((a, b) => a.place - b.place);

type Place = 1 | 2 | 3;

const ORDINAL_SUFFIX: Record<Place, string> = { 1: "st", 2: "nd", 3: "rd" };

const TIER_STYLE: Record<Place, { icon: LucideIcon; ring: string; text: string; glow: string; order: string }> = {
  1: { icon: Trophy, ring: "border-gold", text: "text-gold", glow: "shadow-[0_0_60px_-6px_rgba(201,162,39,0.9)]", order: "order-2" },
  2: { icon: Medal, ring: "border-slate-300", text: "text-slate-300", glow: "shadow-[0_0_36px_-8px_rgba(203,213,225,0.7)]", order: "order-1" },
  3: { icon: Award, ring: "border-amber-600", text: "text-amber-600", glow: "shadow-[0_0_36px_-8px_rgba(217,119,6,0.7)]", order: "order-3" },
};

/**
 * Act 6 — The Reward (prompt.md §12, §43). A championship moment, not
 * three pricing cards — rank badges (icon + numeral) pop in with an
 * elastic, over-rotated bounce building up to the ₹15,000 first-place
 * badge, amounts count up from zero as they land, and the winner's badge
 * keeps a slow idle float/glow afterwards so the reveal stays alive.
 */
export function PrizeSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!sectionRef.current || prefersReducedMotion()) return;

      const tiers = gsap.utils.toArray<HTMLElement>("[data-prize-tier]", sectionRef.current);

      gsap.set(tiers, { opacity: 0, y: 90 });
      gsap.set("[data-prize-badge]", { scale: 0, rotate: -300 });
      gsap.set("[data-prize-icon]", { opacity: 0, scale: 0.2, rotate: 220 });
      gsap.set("[data-prize-glow]", { opacity: 0, scale: 0.5 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%", once: true },
      });

      tl.to("[data-prize-glow]", { opacity: 1, scale: 1, duration: 1.6, ease: "power2.out" });

      // Rendered in DOM order 2nd → 3rd → 1st (see JSX) so the stagger
      // builds anticipation and lands on the biggest prize last, while
      // Tailwind `order-*` classes keep the on-screen podium arrangement
      // (2nd, 1st, 3rd) unchanged.
      tiers.forEach((tier, i) => {
        const badge = tier.querySelector<HTMLElement>("[data-prize-badge]");
        const icon = tier.querySelector<HTMLElement>("[data-prize-icon]");
        const amountEl = tier.querySelector<HTMLElement>("[data-prize-amount]");
        const target = Number(amountEl?.dataset.amount ?? 0);
        const counter = { val: 0 };
        const at = i === 0 ? "-=1.0" : "-=0.7";

        tl.to(tier, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, at)
          .to(badge, { scale: 1, rotate: 0, duration: 1.15, ease: "elastic.out(1, 0.45)" }, "<")
          .to(icon, { opacity: 1, scale: 1, rotate: 0, duration: 0.8, ease: "back.out(3)" }, "<0.15")
          .to(
            counter,
            {
              val: target,
              duration: 1.1,
              ease: "power2.out",
              onUpdate: () => {
                if (amountEl) amountEl.textContent = `₹${formatInr(Math.round(counter.val))}`;
              },
            },
            "<",
          );
      });

      // Idle life after the big entrance — the win keeps breathing instead
      // of going static the instant the timeline finishes.
      const goldBadge = sectionRef.current.querySelector<HTMLElement>('[data-prize-place="1"] [data-prize-badge]');
      gsap.to(goldBadge, { y: -10, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.4 });
      gsap.to("[data-prize-icon]", {
        rotate: 10,
        yoyo: true,
        repeat: -1,
        duration: 1.6,
        ease: "sine.inOut",
        stagger: 0.25,
        delay: 2.2,
      });
      gsap.to("[data-prize-glow]", {
        scale: 1.15,
        opacity: 0.85,
        duration: 2.4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: 2,
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      id="prizes"
      className="relative isolate overflow-hidden border-t border-border bg-void px-6 py-20 text-center sm:px-10 lg:px-16"
    >
      <div
        data-prize-glow
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/20 blur-[140px]"
        aria-hidden
      />

      <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 6 — The Reward</span>
      <h2 className="mt-4 font-display text-5xl tracking-wide text-ink sm:text-7xl">GRAND FINALE PRIZES</h2>
      <p className="mx-auto mt-4 max-w-lg font-heading text-sm text-ink-muted">
        Awarded only at the Grand Finale, common across all three campuses.
      </p>

      <div className="mx-auto mt-20 flex max-w-5xl flex-col items-center gap-14 sm:flex-row sm:items-end sm:justify-center sm:gap-10">
        {[2, 3, 1].map((place) => {
          const prize = sorted.find((p) => p.place === place);
          if (!prize) return null;
          return (
            <PrizeTierBlock
              key={prize.id}
              place={place as Place}
              amount={prize.amountInr}
              label={prize.label}
            />
          );
        })}
      </div>
    </section>
  );
}

function PrizeTierBlock({ place, amount, label }: { place: Place; amount: number; label: string }) {
  const style = TIER_STYLE[place];
  const Icon = style.icon;
  const isLg = place === 1;

  return (
    <div
      data-prize-tier
      data-prize-place={place}
      className={`flex flex-col items-center ${style.order}`}
    >
      <span className="sr-only">{label}</span>
      <div
        data-prize-badge
        className={`relative flex items-center justify-center rounded-full border-2 bg-void ${style.ring} ${style.glow} ${
          isLg ? "size-32 sm:size-40" : "size-24 sm:size-28"
        }`}
      >
        <span className={`flex items-baseline font-display leading-none ${style.text}`}>
          <span className={isLg ? "text-6xl sm:text-7xl" : "text-3xl sm:text-4xl"}>{place}</span>
          <span className={`ml-0.5 font-heading ${isLg ? "text-2xl sm:text-3xl" : "text-base sm:text-lg"}`}>
            {ORDINAL_SUFFIX[place]}
          </span>
        </span>
        <span
          data-prize-icon
          className={`absolute -top-4 -right-4 flex items-center justify-center rounded-full border border-border bg-surface ${
            isLg ? "size-16 sm:size-18" : "size-12 sm:size-14"
          }`}
        >
          <Icon className={`${style.text} ${isLg ? "size-8 sm:size-9" : "size-6 sm:size-7"}`} strokeWidth={1.75} />
        </span>
      </div>
      <p
        data-prize-amount
        data-amount={amount}
        className={
          isLg
            ? "mt-6 bg-gradient-to-b from-gold-light to-gold bg-clip-text font-display text-[clamp(3.5rem,12vw,8rem)] leading-none text-transparent"
            : "mt-6 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-none text-ink-muted"
        }
      >
        ₹{formatInr(amount)}
      </p>
    </div>
  );
}
