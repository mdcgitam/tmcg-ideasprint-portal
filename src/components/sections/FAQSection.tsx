"use client";

import { useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { Reveal } from "@/components/motion/Reveal";
import { faqs } from "@/data/site-config";
import { cn } from "@/lib/utils";

export function FAQSection() {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function toggle(id: string) {
    const wasOpen = openId === id;
    const nextId = wasOpen ? null : id;

    if (openId && panelRefs.current[openId]) {
      gsap.to(panelRefs.current[openId], { height: 0, opacity: 0, duration: 0.35, ease: "power2.inOut" });
    }
    if (nextId && panelRefs.current[nextId]) {
      const el = panelRefs.current[nextId]!;
      gsap.set(el, { height: "auto", opacity: 1 });
      const full = el.offsetHeight;
      gsap.fromTo(el, { height: 0, opacity: 0 }, { height: full, opacity: 1, duration: 0.45, ease: "power2.out" });
    }
    setOpenId(nextId);
  }

  return (
    <section id="faq" className="border-t border-border bg-surface px-6 py-16 sm:px-10 lg:px-16">
      <Reveal className="mx-auto mb-14 max-w-4xl">
        <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">Act 7 — Questions</span>
        <h2 className="mt-4 font-display text-6xl tracking-wide text-ink sm:text-7xl">FAQ</h2>
      </Reveal>

      <Reveal stagger className="mx-auto max-w-4xl divide-y divide-border border-y border-border">
        {faqs.map((faq, i) => {
          const isOpen = openId === faq.id;
          return (
            <div key={faq.id}>
              <button
                type="button"
                data-cursor="interactive"
                onClick={() => toggle(faq.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-6 py-6 text-left"
              >
                <span className={cn("font-mono text-sm", isOpen ? "text-gold" : "text-ink-faint")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={cn("flex-1 font-heading text-lg transition-colors", isOpen ? "text-gold" : "text-ink")}>
                  {faq.question}
                </span>
                <span
                  className={cn(
                    "font-display text-2xl text-ink-muted transition-transform duration-300",
                    isOpen && "rotate-45",
                  )}
                  aria-hidden
                >
                  +
                </span>
              </button>
              <div
                ref={(el) => {
                  panelRefs.current[faq.id] = el;
                }}
                style={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                className="overflow-hidden"
              >
                <p className="max-w-2xl pb-6 pl-12 font-heading text-sm text-ink-muted">{faq.answer}</p>
              </div>
            </div>
          );
        })}
      </Reveal>
    </section>
  );
}
